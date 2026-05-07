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
  id: number | string
  username: string
  display_name: string
  amount: number
  description: string
  created_at: string
  respect_count: number
  has_respected: boolean
  like_count?: number
  has_liked?: boolean
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
  members: { id: string; username: string; display_name: string; total_saved: number; rank: number; is_me: boolean; avatar_url: string | null }[]
}

export interface Notification {
  id: number
  type: string
  message: string
  read: boolean
  created_at: string
  reference_id?: number
}

export interface CheckEntry {
  id: string
  name: string
  price: number
  has_discount: boolean
  answers: {
    needNow: boolean
    hasSimilar: boolean
    thoughtDuration: string
    mood: string
  }
  ai_verdict: string
  ai_comment: string
  outcome: 'stopped' | 'bought' | 'pending'
  timer_deadline: string | null
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
    uploadAvatar: (file: File) => {
      const form = new FormData()
      form.append('avatar', file)
      return client.post<{ avatar_url: string }>('/profile/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    update: (data: {
      display_name?: string
      username?: string
      email?: string | null
      phone?: string | null
      avatar_url?: string | null
      current_password?: string
      new_password?: string
    }) => client.patch<UserProfile>('/profile', data),
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
    invite: (groupId: number, username: string) => client.post(`/groups/${groupId}/invite`, { username }),
  },
  notifications: {
    get: () => client.get<{ items: Notification[]; unread: number }>('/notifications'),
    markRead: () => client.post('/notifications/read'),
  },
  invites: {
    accept: (id: number) => client.post<{ success: boolean; group_id: number; group_name: string }>(`/invites/${id}/accept`),
    decline: (id: number) => client.post(`/invites/${id}/decline`),
  },
  checkLikes: {
    like: (checkId: string) => client.post(`/checks/${checkId}/like`),
    unlike: (checkId: string) => client.delete(`/checks/${checkId}/like`),
  },
  users: {
    list: () => client.get<AccountUser[]>('/users'),
  },
  checks: {
    list: () => client.get<CheckEntry[]>('/checks'),
    create: (data: {
      name: string; price: number; has_discount: boolean
      answers: object; ai_verdict: string; ai_comment: string
      outcome?: string; timer_deadline?: string | null
    }) => client.post<{ id: string }>('/checks', data),
    update: (id: string, data: { outcome?: string; timer_deadline?: string | null }) =>
      client.patch(`/checks/${id}`, data),
  },
}

export default client
