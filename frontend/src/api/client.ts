import axios from 'axios'

const client = axios.create({ baseURL: '/api' })

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export interface Goal {
  id: number
  user_id: number
  title: string
  target_amount: number
  current_amount: number
  status: 'active' | 'completed' | 'inactive'
  created_at: string
}

export interface FeedItem {
  id: number
  username: string
  amount: number
  description: string
  created_at: string
  respect_count: number
  has_respected: boolean
}

export interface Profile {
  id: number
  email: string
  username: string
  total_saved: number
  created_at: string
  active_goal: Goal | null
  goals: Goal[]
}

export interface Group {
  id: number
  name: string
  invite_code: string
  owner_id: number
  member_count: number
  group_total: number
  is_owner: boolean
}

export interface GroupDetail extends Group {
  members: { id: number; username: string; total_saved: number; rank: number; is_me: boolean }[]
}

export interface Notification {
  id: number
  type: string
  message: string
  read: boolean
  created_at: string
}

export const api = {
  auth: {
    register: (data: { email: string; password: string; username: string }) =>
      client.post<{ token: string; user_id: number; username: string }>('/auth/register', data),
    login: (data: { email: string; password: string }) =>
      client.post<{ token: string; user_id: number; username: string }>('/auth/login', data),
  },
  profile: {
    get: () => client.get<Profile>('/profile'),
    delete: () => client.delete('/profile'),
  },
  goals: {
    list: () => client.get<Goal[]>('/goals'),
    create: (data: { title: string; target_amount: number }) => client.post<Goal>('/goals', data),
    update: (id: number, data: { title: string; target_amount: number }) => client.put(`/goals/${id}`, data),
  },
  vetos: {
    create: (data: { amount: number; description: string; goal_id?: number | null }) =>
      client.post<{ id: number; success: boolean; goal_completed: boolean }>('/vetos', data),
    moveGoal: (vetoId: number, goalId: number | null) =>
      client.patch(`/vetos/${vetoId}/goal`, { goal_id: goalId }),
  },
  feed: {
    get: () => client.get<FeedItem[]>('/feed'),
  },
  respects: {
    create: (vetoId: number) => client.post('/respects', { veto_id: vetoId }),
  },
  groups: {
    list: () => client.get<Group[]>('/groups'),
    create: (name: string) => client.post<Group>('/groups', { name }),
    join: (inviteCode: string) => client.post<{ id: number; name: string }>('/groups/join', { invite_code: inviteCode }),
    get: (id: number) => client.get<GroupDetail>(`/groups/${id}`),
    getFeed: (id: number) => client.get<FeedItem[]>(`/groups/${id}/feed`),
    leave: (id: number) => client.delete(`/groups/${id}/leave`),
  },
  notifications: {
    get: () => client.get<{ items: Notification[]; unread: number }>('/notifications'),
    markRead: () => client.post('/notifications/read'),
  },
}

export default client
