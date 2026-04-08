import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './applicant.css'

type ApplicantProfile = {
  id: number
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  photo?: string | null
}

type ResumeListItem = {
  id: number
  profession_id?: number | null
  profession?: {
    id: number
    name: string
  } | null
  created_at?: string | null
  updated_at?: string | null
}

const fetchApplicantProfile = async (): Promise<ApplicantProfile | null> => {
  const { data } = await http.get('/applicants/me')
  return data || null
}

const fetchApplicantResumes = async (): Promise<ResumeListItem[]> => {
  const { data } = await http.get('/applicants/me/resumes')
  return Array.isArray(data) ? data : []
}

const deleteResume = async (resumeId: number) => {
  await http.delete(`/applicants/me/resumes/${resumeId}`)
}

const getApplicantInitials = (profile?: ApplicantProfile | null) => {
  const first = profile?.first_name?.trim()?.[0] || ''
  const last = profile?.last_name?.trim()?.[0] || ''
  const initials = `${first}${last}`.trim().toUpperCase()
  return initials || 'A'
}

const getApplicantName = (profile?: ApplicantProfile | null) => {
  const parts = [profile?.first_name, profile?.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Профиль соискателя'
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Дата не указана'

  try {
    return new Date(value).toLocaleDateString('ru-RU')
  } catch {
    return 'Дата не указана'
  }
}

const getResumeTitle = (resume: ResumeListItem, index: number) => {
  return resume.profession?.name?.trim() || `Резюме #${index + 1}`
}

const DotsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="19" cy="12" r="1.8" fill="currentColor" />
  </svg>
)

export const ApplicantPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const profileQuery = useQuery({
    queryKey: ['applicant-profile'],
    queryFn: fetchApplicantProfile,
  })

  const resumesQuery = useQuery({
    queryKey: ['applicant-resumes'],
    queryFn: fetchApplicantResumes,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-resumes'] })
      setOpenMenuId(null)
    },
  })

  const profile = profileQuery.data
  const resumes = resumesQuery.data || []

  return (
    <div className="applicant-page">
      <Header />

      <main className="applicant-page__main">
        <section className="applicant-dashboard">
          <div className="container">
            <div className="applicant-dashboard__layout">
              <section className="applicant-dashboard__main-column">
                <div className="applicant-card applicant-card--main">
                  <div className="applicant-card__head">
                    <div>
                      <span className="applicant-card__eyebrow">Мои резюме</span>
                      <h1 className="applicant-card__title">Мои резюме</h1>
                      <p className="applicant-card__subtitle">
                        Создавайте и обновляйте резюме, чтобы работодатели быстрее находили вас.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn--primary applicant-card__create-btn"
                      onClick={() => navigate('/applicant/resume/create')}
                    >
                      Создать резюме
                    </button>
                  </div>

                  {resumesQuery.isLoading && (
                    <div className="resume-list">
                      <div className="resume-item resume-item--skeleton" />
                      <div className="resume-item resume-item--skeleton" />
                    </div>
                  )}

                  {resumesQuery.isError && (
                    <div className="applicant-empty">
                      Не удалось загрузить список резюме.
                    </div>
                  )}

                  {!resumesQuery.isLoading && !resumesQuery.isError && resumes.length === 0 && (
                    <div className="applicant-empty">
                      <h3>У вас пока нет резюме</h3>
                      <p>Создайте первое резюме, чтобы начать откликаться.</p>
                    </div>
                  )}

                  {!resumesQuery.isLoading && !resumesQuery.isError && resumes.length > 0 && (
                    <div className="resume-list">
                      {resumes.map((resume, index) => (
                        <article key={resume.id} className="resume-item">
                          <div className="resume-item__top">
                            <div className="resume-item__title-wrap">
                              <h2>{getResumeTitle(resume, index)}</h2>
                              <div className="resume-item__meta">
                                Обновлено {formatDate(resume.updated_at)}
                              </div>
                            </div>

                            <div
                              className="resume-item__menu-wrap"
                              ref={openMenuId === resume.id ? menuRef : null}
                            >
                              <button
                                type="button"
                                className="resume-item__menu-trigger"
                                onClick={() =>
                                  setOpenMenuId((prev) => (prev === resume.id ? null : resume.id))
                                }
                              >
                                <DotsIcon />
                              </button>

                              {openMenuId === resume.id && (
                                <div className="resume-item__menu">
                                  <button
                                    type="button"
                                    className="resume-item__menu-btn"
                                    onClick={() => navigate(`/applicant/resume/${resume.id}/edit`)}
                                  >
                                    Редактировать
                                  </button>

                                  <button
                                    type="button"
                                    className="resume-item__menu-btn resume-item__menu-btn--danger"
                                    onClick={() => deleteMutation.mutate(resume.id)}
                                    disabled={deleteMutation.isPending}
                                  >
                                    Удалить
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn btn--primary resume-item__open-btn"
                            onClick={() => navigate(`/applicant/resume/${resume.id}`)}
                          >
                            Открыть
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <aside className="applicant-dashboard__sidebar">
                <div className="applicant-card applicant-card--sidebar">
                  <div className="profile-mini">
                    {profile?.photo ? (
                      <img
                        src={profile.photo}
                        alt={getApplicantName(profile)}
                        className="profile-mini__avatar-img"
                      />
                    ) : (
                      <div className="profile-mini__avatar">
                        {getApplicantInitials(profile)}
                      </div>
                    )}

                    <div className="profile-mini__content">
                      <h2>Профиль соискателя</h2>
                      <p>
                        Заполните данные профиля и настройте видимость для работодателей.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn--outline profile-mini__button"
                    onClick={() => navigate('/applicant/profile')}
                  >
                    Перейти в профиль
                  </button>

                  <button
                    type="button"
                    className="btn btn--primary profile-mini__button"
                    onClick={() => navigate('/vacancies')}
                  >
                    Смотреть вакансии
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}