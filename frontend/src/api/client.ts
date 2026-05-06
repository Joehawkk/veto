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
  title: string
  target_amount: number
  current_amount: number
  status: 'active' | 'completed' | 'inactive'
  created_at: string
}

export interface VetoItem {
  id: number
  goal_id: number | null
  amount: number
  description: string
  created_at: string
}

export interface FeedItem {
  id: number
  username: string
  display_name: string
  amount: number
  description: string
  created_at: string
  respect_count: number
  has_respected: boolean
}

export type Profile = UserProfile

export interface UserProfile {
  id: string
  username: string
  display_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  total_saved: number
  created_at: string
  active_goal?: Goal | null
  goals?: Goal[]
}

export interface AccountUser {
  id: string
  username: string
  display_name: string
  total_saved: number
  created_at: string
  veto_count: number
}

export interface Group {
  id: number
  name: string
  invite_code: string
  owner_id: string
  member_count: number
  group_total: number
  is_owner: boolean
}

export interface GroupDetail extends Group {
  members: { id: string; username: string; display_name: string; total_saved: number; rank: number; is_me: boolean }[]
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
    register: (data: { username: string; display_name: string; password: string }) =>
      client.post<{ token: string; user_id: string; username: string; display_name: string }>('/auth/register', data),
    login: (data: { username: string; password: string }) =>
      client.post<{ token: string; user_id: string; username: string; display_name: string }>('/auth/login', data),
  },
  me: {
    get: () => client.get<UserProfile>('/me'),
    update: (data: { display_name?: string; email?: string | null; phone?: string | null; avatar_url?: string | null }) =>
      client.patch<UserProfile>('/profile', data),
  },
  profile: {
    get: () => client.get<UserProfile>('/profile'),
    delete: () => client.delete('/profile'),
  },
  goals: {
    list: () => client.get<Goal[]>('/goals'),
    create: (data: { title: string; target_amount: number }) => client.post<Goal>('/goals', data),
    update: (id: number, data: { title: string; target_amount: number }) => client.put(`/goals/${id}`, data),
  },
  vetos: {
    list: () => client.get<VetoItem[]>('/vetos'),
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
  users: {
    list: () => client.get<AccountUser[]>('/users'),
  },
}

export default client
