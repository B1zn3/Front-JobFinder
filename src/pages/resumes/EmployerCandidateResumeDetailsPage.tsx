import type { AxiosError } from 'axios'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './employer-candidate-resume-details.css'

type ApiValidationItem = {
  loc?: Array<string | number>
  msg?: string
  type?: string
}

type ApiErrorResponse = {
  detail?: string | { message?: string; error?: string } | ApiValidationItem[]
  message?: string
  error?: string
}

type ResumeSkill =
  | string
  | {
      id?: number
      name?: string | null
    }

type WorkExperienceItem = {
  id: number
  company_name: string
  position: string
  start_date?: string | null
  end_date?: string | null
  description?: string | null
}

type EducationItem = {
  id: number
  institution_id?: number | null
  institution_name?: string | null
  institution?: {
    id: number
    name: string
  } | null
  start_date?: string | null
  end_date?: string | null
}

type CandidateResumeDetails = {
  id: number
  applicant_id: number

  applicant_full_name?: string | null
  applicant_first_name?: string | null
  applicant_last_name?: string | null
  applicant_middle_name?: string | null
  applicant_city_name?: string | null
  applicant_photo?: string | null
  applicant_age?: number | null
  applicant_gender?: string | null
  applicant_phone?: string | null
  applicant_birth_date?: string | null

  profession_id?: number | null
  profession_name?: string | null

  skills?: ResumeSkill[]
  work_experiences?: WorkExperienceItem[]
  educations?: EducationItem[]

  work_experiences_count?: number
  applications_count?: number
  latest_position?: string | null
  latest_company?: string | null
  experience_years?: number

  created_at?: string | null
  updated_at?: string | null
}

const toArray = <T,>(value: unknown): T[] => {
  return Array.isArray(value) ? value : []
}

const uniqueMessages = (messages: string[]) => {
  return Array.from(new Set(messages.filter(Boolean)))
}

const translateApiErrorMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase()

  if (lower.includes('not authenticated') || lower.includes('unauthorized')) {
    return 'Сессия истекла. Войдите в аккаунт заново.'
  }

  if (lower.includes('forbidden') || lower.includes('доступ')) {
    return 'Недостаточно прав. Эта страница доступна работодателю.'
  }

  if (lower.includes('resume') || lower.includes('резюме')) {
    return 'Резюме не найдено.'
  }

  if (status === 400) return message || 'Некорректный запрос.'
  if (status === 401) return 'Сессия истекла. Войдите в аккаунт заново.'
  if (status === 403) return 'Недостаточно прав. Эта страница доступна работодателю.'
  if (status === 404) return 'Резюме не найдено.'
  if (status === 422) return 'Некорректный идентификатор резюме.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  return message || 'Не удалось выполнить действие.'
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<ApiErrorResponse>
  const status = axiosError.response?.status
  const data = axiosError.response?.data

  if (axiosError.response) {
    if (Array.isArray(data?.detail)) {
      const messages = uniqueMessages(
        data.detail.map((item) => translateApiErrorMessage(item.msg || '', status)),
      )

      return messages[0] || fallback
    }

    if (typeof data?.detail === 'string') {
      return translateApiErrorMessage(data.detail, status)
    }

    if (data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
      const message = data.detail.message || data.detail.error
      if (message) return translateApiErrorMessage(message, status)
    }

    if (data?.message) return translateApiErrorMessage(data.message, status)
    if (data?.error) return translateApiErrorMessage(data.error, status)

    return translateApiErrorMessage('', status)
  }

  if (axiosError.request) {
    return 'Нет соединения с сервером. Проверьте интернет или попробуйте позже.'
  }

  return fallback
}

const fetchCandidateResumeDetails = async (
  resumeId: number,
): Promise<CandidateResumeDetails> => {
  const { data } = await http.get(`/companies/resumes/${resumeId}`)
  return data?.item || data
}

const normalizeSkills = (skills?: ResumeSkill[]) => {
  return toArray<ResumeSkill>(skills)
    .map((skill) => {
      if (typeof skill === 'string') return skill
      return skill.name || ''
    })
    .filter(Boolean)
}

const getFullName = (resume?: CandidateResumeDetails) => {
  if (!resume) return 'Кандидат'

  if (resume.applicant_full_name?.trim()) {
    return resume.applicant_full_name.trim()
  }

  const parts = [
    resume.applicant_last_name,
    resume.applicant_first_name,
    resume.applicant_middle_name,
  ].filter(Boolean)

  return parts.join(' ') || `Соискатель #${resume.applicant_id}`
}

const getInitials = (name: string) => {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'К'
  )
}

const getGenderLabel = (value?: string | null) => {
  if (!value) return 'Не указан'

  const normalized = value.toLowerCase()

  if (normalized === 'м' || normalized.includes('муж')) return 'Мужской'
  if (normalized === 'ж' || normalized.includes('жен')) return 'Женский'

  return value
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('ru-RU')
}

const formatDate = (value?: string | null) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const formatMonthYear = (value?: string | null) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  })
}

const formatPeriod = (start?: string | null, end?: string | null) => {
  const startLabel = formatMonthYear(start)
  const endLabel = end ? formatMonthYear(end) : 'по настоящее время'

  return `${startLabel} — ${endLabel}`
}

const formatExperience = (value?: number | null) => {
  const years = Number(value ?? 0)

  if (!Number.isFinite(years) || years <= 0) return 'Без опыта'
  if (years < 1) return 'Менее года'

  return `${years.toLocaleString('ru-RU')}+ лет`
}

const InfoItem = ({
  label,
  value,
}: {
  label: string
  value?: string | number | null
}) => (
  <div className="candidate-resume-info-item">
    <span>{label}</span>
    <strong>{value || '—'}</strong>
  </div>
)

export const EmployerCandidateResumeDetailsPage = () => {
  const { resumeId } = useParams()
  const navigate = useNavigate()

  const numericResumeId = Number(resumeId)

  const resumeQuery = useQuery({
    queryKey: ['employer-candidate-resume-detail', numericResumeId],
    queryFn: () => fetchCandidateResumeDetails(numericResumeId),
    enabled: Number.isFinite(numericResumeId) && numericResumeId > 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const resume = resumeQuery.data
  const fullName = getFullName(resume)

  const skills = useMemo(() => normalizeSkills(resume?.skills), [resume?.skills])

  const workExperiences = useMemo(() => {
    return toArray<WorkExperienceItem>(resume?.work_experiences)
  }, [resume?.work_experiences])

  const educations = useMemo(() => {
    return toArray<EducationItem>(resume?.educations)
  }, [resume?.educations])

  if (!resumeId || Number.isNaN(numericResumeId) || numericResumeId <= 0) {
    return (
      <div className="candidate-resume-view-page">
        <Header />

        <main className="candidate-resume-view-page__main">
          <div className="candidate-resume-view-container">
            <div className="candidate-resume-empty candidate-resume-empty--error">
              Некорректный идентификатор резюме.
            </div>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  if (resumeQuery.isLoading) {
    return (
      <div className="candidate-resume-view-page">
        <Header />

        <main className="candidate-resume-view-page__main">
          <div className="candidate-resume-view-container">
            <div className="candidate-resume-empty">Загрузка резюме...</div>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  if (resumeQuery.isError || !resume) {
    return (
      <div className="candidate-resume-view-page">
        <Header />

        <main className="candidate-resume-view-page__main">
          <div className="candidate-resume-view-container">
            <div className="candidate-resume-empty candidate-resume-empty--error">
              {getErrorMessage(resumeQuery.error, 'Не удалось загрузить резюме.')}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  return (
    <div className="candidate-resume-view-page">
      <Header />

      <main className="candidate-resume-view-page__main">
        <div className="candidate-resume-view-container">
          <section className="candidate-resume-view-card candidate-resume-hero">
            <div className="candidate-resume-hero__topbar">
              <button
                type="button"
                className="candidate-resume-btn candidate-resume-btn--outline"
                onClick={() => navigate('/employer/candidates')}
              >
                ← К списку кандидатов
              </button>

              <button
                type="button"
                className="candidate-resume-btn candidate-resume-btn--ghost"
                onClick={() => window.close()}
              >
                Закрыть вкладку
              </button>
            </div>

            <div className="candidate-resume-hero__body">
              <div className="candidate-resume-hero__avatar-wrap">
                {resume.applicant_photo ? (
                  <img
                    src={resume.applicant_photo}
                    alt={fullName}
                    className="candidate-resume-hero__avatar"
                  />
                ) : (
                  <div className="candidate-resume-hero__avatar candidate-resume-hero__avatar--placeholder">
                    {getInitials(fullName)}
                  </div>
                )}
              </div>

              <div className="candidate-resume-hero__content">
                <div className="candidate-resume-label">Резюме кандидата</div>

                <h1>{resume.profession_name || 'Резюме'}</h1>

                <p>{fullName}</p>

                <div className="candidate-resume-hero__meta">
                  Создано: {formatDateTime(resume.created_at)} · Обновлено:{' '}
                  {formatDateTime(resume.updated_at)}
                </div>
              </div>
            </div>
          </section>

          <section className="candidate-resume-view-card candidate-resume-section">
            <div className="candidate-resume-section__head">
              <div>
                <h2>Профиль соискателя</h2>
                <p>Основная информация о кандидате.</p>
              </div>
            </div>

            <div className="candidate-resume-info-grid">
              <InfoItem label="ФИО" value={fullName} />
              <InfoItem label="Профессия" value={resume.profession_name || 'Не указана'} />
              <InfoItem label="Город" value={resume.applicant_city_name || 'Не указан'} />
              <InfoItem label="Пол" value={getGenderLabel(resume.applicant_gender)} />
              <InfoItem
                label="Возраст"
                value={
                  typeof resume.applicant_age === 'number'
                    ? `${resume.applicant_age} лет`
                    : 'Не указан'
                }
              />
              <InfoItem label="Дата рождения" value={formatDate(resume.applicant_birth_date)} />
              <InfoItem label="Телефон" value={resume.applicant_phone || 'Не указан'} />
              <InfoItem label="Опыт" value={formatExperience(resume.experience_years)} />
            </div>
          </section>

          <section className="candidate-resume-view-card candidate-resume-section">
            <div className="candidate-resume-section__head">
              <div>
                <h2>Навыки</h2>
                <p>Ключевые навыки, указанные в резюме.</p>
              </div>
            </div>

            {skills.length > 0 ? (
              <div className="candidate-resume-chip-list">
                {skills.map((skill) => (
                  <span key={skill} className="candidate-resume-chip">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <div className="candidate-resume-empty-inline">Навыки не указаны.</div>
            )}
          </section>

          <section className="candidate-resume-view-card candidate-resume-section">
            <div className="candidate-resume-section__head">
              <div>
                <h2>Опыт работы</h2>
                <p>История работы кандидата по этому резюме.</p>
              </div>

              <div className="candidate-resume-count-badge">
                {workExperiences.length} записей
              </div>
            </div>

            {workExperiences.length > 0 ? (
              <div className="candidate-resume-timeline">
                {workExperiences.map((experience, index) => (
                  <article key={experience.id || index} className="candidate-resume-timeline-card">
                    <div className="candidate-resume-timeline-card__head">
                      <div>
                        <h3>{experience.position || 'Должность не указана'}</h3>
                        <p>{experience.company_name || 'Компания не указана'}</p>
                      </div>

                      <span>
                        {formatPeriod(experience.start_date, experience.end_date)}
                      </span>
                    </div>

                    {experience.description ? (
                      <div className="candidate-resume-description">
                        {experience.description}
                      </div>
                    ) : (
                      <div className="candidate-resume-muted">
                        Описание опыта не добавлено.
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="candidate-resume-empty-inline">Опыт работы не указан.</div>
            )}
          </section>

          <section className="candidate-resume-view-card candidate-resume-section">
            <div className="candidate-resume-section__head">
              <div>
                <h2>Образование</h2>
                <p>Учебные заведения из профиля соискателя.</p>
              </div>

              <div className="candidate-resume-count-badge">
                {educations.length} записей
              </div>
            </div>

            {educations.length > 0 ? (
              <div className="candidate-resume-timeline">
                {educations.map((education, index) => {
                  const institutionName =
                    education.institution_name ||
                    education.institution?.name ||
                    'Учебное заведение не указано'

                  return (
                    <article
                      key={education.id || index}
                      className="candidate-resume-timeline-card"
                    >
                      <div className="candidate-resume-timeline-card__head">
                        <div>
                          <h3>{institutionName}</h3>
                          <p>Образование</p>
                        </div>

                        <span>
                          {formatPeriod(education.start_date, education.end_date)}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="candidate-resume-empty-inline">Образование не указано.</div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}