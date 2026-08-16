export type DanceAnalyticsProfile = {
  participant_id: string
  role: string
  skills: Record<string, string>
  available: boolean
}

export type DanceAnalyticsInvitation = {
  sender_id: string
  receiver_id: string
  style: string
  status: string
  created_at: string
  responded_at: string | null
}

export function buildDanceAnalytics(
  profiles: DanceAnalyticsProfile[],
  invitations: DanceAnalyticsInvitation[],
  timezone = "Europe/Rome"
) {
  const statusCounts = invitations.reduce<Record<string, number>>((counts, invitation) => {
    counts[invitation.status] = (counts[invitation.status] || 0) + 1
    return counts
  }, {})
  const styleCounts = new Map<string, { total: number; accepted: number }>()
  const roleCounts = new Map<string, number>()
  const levelCounts = new Map<string, number>()
  const hourCounts = new Map<number, number>()
  const responseMinutes: number[] = []
  const inviters = new Set<string>()
  const receivers = new Set<string>()
  const engaged = new Set<string>()
  let hourFormatter: Intl.DateTimeFormat

  try {
    hourFormatter = new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    })
  } catch {
    hourFormatter = new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "Europe/Rome",
    })
  }

  profiles.forEach((profile) => {
    roleCounts.set(profile.role, (roleCounts.get(profile.role) || 0) + 1)
    Object.values(profile.skills || {}).forEach((level) => {
      levelCounts.set(level, (levelCounts.get(level) || 0) + 1)
    })
  })

  invitations.forEach((invitation) => {
    inviters.add(invitation.sender_id)
    receivers.add(invitation.receiver_id)
    engaged.add(invitation.sender_id)
    engaged.add(invitation.receiver_id)

    const style = styleCounts.get(invitation.style) || { total: 0, accepted: 0 }
    style.total += 1
    if (invitation.status === "accepted") style.accepted += 1
    styleCounts.set(invitation.style, style)

    const createdAt = new Date(invitation.created_at)
    if (!Number.isNaN(createdAt.getTime())) {
      const hour = Number.parseInt(hourFormatter.format(createdAt), 10)
      if (Number.isInteger(hour)) hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)

      if (invitation.responded_at) {
        const respondedAt = new Date(invitation.responded_at)
        const elapsed = (respondedAt.getTime() - createdAt.getTime()) / 60000
        if (Number.isFinite(elapsed) && elapsed >= 0) responseMinutes.push(elapsed)
      }
    }
  })

  const profileIds = new Set(profiles.map((profile) => profile.participant_id))
  const engagedProfiles = [...engaged].filter((participantId) => profileIds.has(participantId)).length
  const answered = (statusCounts.accepted || 0) + (statusCounts.declined || 0) + (statusCounts.later || 0)

  return {
    profiles: profiles.length,
    available: profiles.filter((profile) => profile.available).length,
    invitations: invitations.length,
    statuses: {
      pending: statusCounts.pending || 0,
      accepted: statusCounts.accepted || 0,
      declined: statusCounts.declined || 0,
      later: statusCounts.later || 0,
      cancelled: statusCounts.cancelled || 0,
      expired: statusCounts.expired || 0,
    },
    acceptanceRate: answered ? Math.round(((statusCounts.accepted || 0) / answered) * 100) : 0,
    averageResponseMinutes: responseMinutes.length
      ? Math.round((responseMinutes.reduce((total, value) => total + value, 0) / responseMinutes.length) * 10) / 10
      : null,
    uniqueInviters: inviters.size,
    uniqueReceivers: receivers.size,
    engagedProfiles,
    untouchedProfiles: Math.max(0, profiles.length - engagedProfiles),
    styles: [...styleCounts.entries()]
      .map(([style, counts]) => ({ style, ...counts }))
      .sort((first, second) => second.total - first.total),
    roles: [...roleCounts.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((first, second) => second.count - first.count),
    levels: [...levelCounts.entries()]
      .map(([level, count]) => ({ level, count }))
      .sort((first, second) => second.count - first.count),
    hourlyActivity: [...hourCounts.entries()]
      .map(([hour, count]) => ({ hour: `${String(hour).padStart(2, "0")}:00`, count }))
      .sort((first, second) => first.hour.localeCompare(second.hour)),
  }
}
