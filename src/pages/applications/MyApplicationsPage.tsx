import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './my-applications.css'

type RawApplication = Record<string, unknown>

type ApplicationItem = {
  id: number
  vacancyId: number | null
  vacancyTitle: string
  companyName: string
  status: string
  createdAt: string | null
  updatedAt: string | null
  resumeTitle: string
  salaryText: string
  locationText: string
}

type StatusFilter = 'all' | 'sent' | 'review' | 'accepted' | 'rejected'

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : [])

const safeString = (value: unknown) => {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

const safeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Дата не указана'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Дата не указана'

  return date.toLocaleString('ru-RU')
}

const normalizeStatus = (value: string) => {
  const normalized = value.trim().toLowerCase()

  if (!normalized) return 'Отправлен'
  if (['pending', 'sent', 'submitted', 'new'].includes(normalized)) return 'Отправлен'
  if (['review', 'in_review', 'processing'].includes(normalized)) return 'На рассмотрении'
  if (['accepted', 'approved', 'invited'].includes(normalized)) return 'Положительный ответ'
  if (['rejected', 'declined', 'denied'].includes(normalized)) return 'Отказ'

  return value
}

const getStatusFilter = (status: string): StatusFilter => {
  const normalized = status.toLowerCase()

  if (normalized.includes('отказ')) return 'rejected'
  if (normalized.includes('рассмотр')) return 'review'
  if (normalized.includes('полож')) return 'accepted'
  return 'sent'
}

const formatSalary = (application: RawApplication) => {
  const vacancy = (application.vacancy ?? application.job ?? null) as Record<string, unknown> | null

  const salaryFrom =
    safeNumber(application.salary_from) ??
    safeNumber(vacancy?.salary_from) ??
    safeNumber(vacancy?.salaryFrom)

  const salaryTo =
    safeNumber(application.salary_to) ??
    safeNumber(vacancy?.salary_to) ??
    safeNumber(vacancy?.salaryTo)

  const currency =
    safeString(application.currency) ||
    safeString(vacancy?.currency) ||
    'BYN'

  if (salaryFrom && salaryTo) return `${salaryFrom}–${salaryTo} ${currency}`
  if (salaryFrom) return `от ${salaryFrom} ${currency}`
  if (salaryTo) return `до ${salaryTo} ${currency}`

  return 'Зарплата не указана'
}

const normalizeApplication = (application: RawApplication, index: number): ApplicationItem => {
  const vacancy = (application.vacancy ?? application.job ?? null) as Record<string, unknown> | null
  const company = (vacancy?.company ?? application.company ?? null) as Record<string, unknown> | null
  const resume = (application.resume ?? null) as Record<string, unknown> | null
  const profession = (resume?.profession ?? null) as Record<string, unknown> | null
  const city = (vacancy?.city ?? application.city ?? null) as Record<string, unknown> | null

  const id =
    safeNumber(application.id) ??
    safeNumber(application.application_id) ??
    index + 1

  const vacancyId =
    safeNumber(application.vacancy_id) ??
    safeNumber(vacancy?.id)

  const vacancyTitle =
    safeString(application.vacancy_title) ||
    safeString(vacancy?.title) ||
    safeString(vacancy?.name) ||
    'Вакансия без названия'

  const companyName =
    safeString(application.company_name) ||
    safeString(company?.name) ||
    'Компания не указана'

  const status =
    normalizeStatus(
      safeString(application.status) ||
        safeString(application.application_status) ||
        safeString(application.state) ||
        'Отправлен',
    )

  const createdAt =
    safeString(application.created_at) ||
    safeString(application.applied_at) ||
    safeString(application.createdAt) ||
    null

  const updatedAt =
    safeString(application.updated_at) ||
    safeString(application.updatedAt) ||
    null

  const resumeTitle =
    safeString(application.resume_title) ||
    safeString(profession?.name) ||
    safeString(resume?.title) ||
    'Резюме не указано'

  const locationText =
    safeString(application.city_name) ||
    safeString(city?.name) ||
    safeString(vacancy?.location) ||
    'Локация не указана'

  return {
    id,
    vacancyId,
    vacancyTitle,
    companyName,
    status,
    createdAt,
    updatedAt,
    resumeTitle,
    salaryText: formatSalary(application),
    locationText,
  }
}

const fetchMyApplications = async (): Promise<ApplicationItem[]> => {
  const { data } = await http.get('/applicants/me/applications')
  const items = toArray<RawApplication>(data)

  return items
    .map(normalizeApplication)
    .sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return right - left
    })
}

const getStatusClassName = (status: string) => {
  const normalized = status.toLowerCase()

  if (normalized.includes('отказ')) return 'application-status application-status--rejected'
  if (normalized.includes('рассмотр')) return 'application-status application-status--review'
  if (normalized.includes('полож')) return 'application-status application-status--accepted'
  return 'application-status application-status--sent'
}

export const MyApplicationsPage = () => {
  const navigate = useNavigate()
  const [search] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const applicationsQuery = useQuery({
    queryKey: ['applicant-my-applications'],
    queryFn: fetchMyApplications,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const applications = useMemo(() => applicationsQuery.data || [], [applicationsQuery.data])

  const filteredApplications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return applications.filter((application) => {
      const matchesStatus =
        statusFilter === 'all' || getStatusFilter(application.status) === statusFilter

      const matchesSearch =
        !normalizedSearch ||
        application.vacancyTitle.toLowerCase().includes(normalizedSearch) ||
        application.companyName.toLowerCase().includes(normalizedSearch) ||
        application.resumeTitle.toLowerCase().includes(normalizedSearch)

      return matchesStatus && matchesSearch
    })
  }, [applications, search, statusFilter])

  const stats = useMemo(() => {
    return {
      all: applications.length,
      sent: applications.filter((item) => getStatusFilter(item.status) === 'sent').length,
      review: applications.filter((item) => getStatusFilter(item.status) === 'review').length,
      accepted: applications.filter((item) => getStatusFilter(item.status) === 'accepted').length,
      rejected: applications.filter((item) => getStatusFilter(item.status) === 'rejected').length,
    }
  }, [applications])

  return (
    <div className="my-applications-page">
      <Header />

      <main className="my-applications-page__main">
        <div className="my-applications-page__container">
          <section className="my-applications-shell">
            <div className="my-applications-shell__topbar">
            </div>

            <div className="my-applications-hero">
              <h1 className="my-applications-hero__title">Мои отклики</h1>
            </div>

            <div className="my-applications-summary">
              <div className="summary-tile">
                <div className="summary-tile__label">Всего</div>
                <div className="summary-tile__value">{stats.all}</div>
              </div>

              <div className="summary-tile">
                <div className="summary-tile__label">Отправлены</div>
                <div className="summary-tile__value">{stats.sent}</div>
              </div>

              <div className="summary-tile">
                <div className="summary-tile__label">На рассмотрении</div>
                <div className="summary-tile__value">{stats.review}</div>
              </div>

              <div className="summary-tile">
                <div className="summary-tile__label">Положительный ответ</div>
                <div className="summary-tile__value">{stats.accepted}</div>
              </div>

              <div className="summary-tile">
                <div className="summary-tile__label">Отказы</div>
                <div className="summary-tile__value">{stats.rejected}</div>
              </div>
            </div>

            <div className="my-applications-toolbar">
              <div className="my-applications-filters">
                <button
                  type="button"
                  className={`my-applications-filter ${statusFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  Все
                </button>

                <button
                  type="button"
                  className={`my-applications-filter ${statusFilter === 'sent' ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter('sent')}
                >
                  Отправлен
                </button>

                <button
                  type="button"
                  className={`my-applications-filter ${statusFilter === 'review' ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter('review')}
                >
                  На рассмотрении
                </button>

                <button
                  type="button"
                  className={`my-applications-filter ${statusFilter === 'accepted' ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter('accepted')}
                >
                  Положительный
                </button>

                <button
                  type="button"
                  className={`my-applications-filter ${statusFilter === 'rejected' ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter('rejected')}
                >
                  Отказ
                </button>
              </div>
            </div>

            {applicationsQuery.isLoading && (
              <div className="my-applications-state">Загрузка откликов...</div>
            )}

            {applicationsQuery.isError && (
              <div className="my-applications-state my-applications-state--error">
                Не удалось загрузить отклики.
              </div>
            )}

            {!applicationsQuery.isLoading &&
              !applicationsQuery.isError &&
              applications.length === 0 && (
                <div className="my-applications-empty">
                  <h2>У вас пока нет откликов</h2>
                  <p>Когда вы откликнетесь на вакансию, она появится здесь.</p>

                  <button
                    type="button"
                    className="my-applications-btn my-applications-btn--primary"
                    onClick={() => navigate('/vacancies')}
                  >
                    Смотреть вакансии
                  </button>
                </div>
              )}

            {!applicationsQuery.isLoading &&
              !applicationsQuery.isError &&
              applications.length > 0 &&
              filteredApplications.length === 0 && (
                <div className="my-applications-state">
                  По текущим фильтрам откликов не найдено.
                </div>
              )}

            {!applicationsQuery.isLoading &&
              !applicationsQuery.isError &&
              filteredApplications.length > 0 && (
                <div className="my-applications-list">
                  {filteredApplications.map((application) => (
                    <article key={application.id} className="application-card">
                      <div className="application-card__head">
                        <div className="application-card__main">
                          <div className="application-card__company">{application.companyName}</div>
                          <h2 className="application-card__title">{application.vacancyTitle}</h2>
                        </div>

                        <div className={getStatusClassName(application.status)}>
                          {application.status}
                        </div>
                      </div>

                      <div className="application-card__facts">
                        <div className="application-fact">
                          <span className="application-fact__label">Резюме</span>
                          <span className="application-fact__value">{application.resumeTitle}</span>
                        </div>

                        <div className="application-fact">
                          <span className="application-fact__label">Локация</span>
                          <span className="application-fact__value">{application.locationText}</span>
                        </div>

                        <div className="application-fact">
                          <span className="application-fact__label">Зарплата</span>
                          <span className="application-fact__value">{application.salaryText}</span>
                        </div>

                        <div className="application-fact">
                          <span className="application-fact__label">Дата отклика</span>
                          <span className="application-fact__value">
                            {formatDateTime(application.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="application-card__footer">
                        <div className="application-card__updated">
                          Обновлено: {formatDateTime(application.updatedAt || application.createdAt)}
                        </div>

                        <div className="application-card__actions">
                          {application.vacancyId ? (
                            <button
                              type="button"
                              className="my-applications-btn my-applications-btn--outline"
                              onClick={() => navigate(`/vacancies/${application.vacancyId}`)}
                            >
                              Открыть вакансию
                            </button>
                          ) : null}

                          <button
                            type="button"
                            className="my-applications-btn my-applications-btn--ghost"
                            onClick={() => navigate('/vacancies')}
                          >
                            Другие вакансии
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}