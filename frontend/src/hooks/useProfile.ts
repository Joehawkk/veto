import { useState, useCallback } from 'react'
import { getProfile, setProfile, isOnboarded, setOnboarded, type Profile } from '../lib/storage'

export function useProfile() {
  const [profile, setProfileState] = useState<Profile | null>(() => getProfile())
  const [onboarded, setOnboardedState] = useState(() => isOnboarded())

  const saveProfile = useCallback((p: Profile) => {
    setProfile(p)
    setProfileState(p)
  }, [])

  const completeOnboarding = useCallback((p: Profile) => {
    setProfile(p)
    setOnboarded()
    setProfileState(p)
    setOnboardedState(true)
  }, [])

  return { profile, onboarded, saveProfile, completeOnboarding }
}
