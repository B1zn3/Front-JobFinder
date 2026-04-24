import { useEffect, useMemo, useState } from 'react'
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

type FilterItem = {
  value: StatusFilter
  label: string
}

const PAGE_SIZE = 5

const FILTERS: FilterItem[] = [
  { value: 'all', label: 'Все' },
  { value: 'sent', label: 'Отправлены' },
  { value: 'review', label: 'На рассмотрении' },
  { value: 'accepted', label: 'Положительные' },
  { value: 'rejected', label: 'Отказы' },
]

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

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

const extractApplicationsArray = (value: unknown): RawApplication[] => {
  if (Array.isArray(value)) return value as RawApplication[]

  const object = asRecord(value)
  if (!object) return []

  const possibleKeys = ['items', 'results', 'applications', 'data']

  for (const key of possibleKeys) {
    const nested = object[key]

    if (Array.isArray(nested)) {
      return nested as RawApplication[]
    }
  }

  return []
}

const formatMoney = (value: number) => {
  return new Intl.NumberFormat('ru-RU').format(value)
}

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Дата не указана'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Дата не указана'

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const normalizeStatus = (value: string) => {
  const normalized = value.trim().toLowerCase()

  if (!normalized) return 'Отправлен'

  if (['pending', 'sent', 'submitted', 'new', 'created'].includes(normalized)) {
    return 'Отправлен'
  }

  if (['review', 'in_review', 'processing', 'viewed', 'considering'].includes(normalized)) {
    return 'На рассмотрении'
  }

  if (['accepted', 'approved', 'invited', 'success', 'positive'].includes(normalized)) {
    return 'Положительный ответ'
  }

  if (['rejected', 'declined', 'denied', 'failed', 'negative'].includes(normalized)) {
    return 'Отказ'
  }

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
  const vacancy = asRecord(application.vacancy ?? application.job)

  const salaryFrom =
    safeNumber(application.salary_from) ??
    safeNumber(application.salaryFrom) ??
    safeNumber(vacancy?.salary_from) ??
    safeNumber(vacancy?.salaryFrom)

  const salaryTo =
    safeNumber(application.salary_to) ??
    safeNumber(application.salaryTo) ??
    safeNumber(vacancy?.salary_to) ??
    safeNumber(vacancy?.salaryTo)

  const currency =
    safeString(application.currency) ||
    safeString(vacancy?.currency) ||
    'BYN'

  if (salaryFrom !== null && salaryTo !== null) {
    return `${formatMoney(salaryFrom)}–${formatMoney(salaryTo)} ${currency}`
  }

  if (salaryFrom !== null) return `от ${formatMoney(salaryFrom)} ${currency}`
  if (salaryTo !== null) return `до ${formatMoney(salaryTo)} ${currency}`

  return 'Зарплата не указана'
}

const normalizeApplication = (application: RawApplication, index: number): ApplicationItem => {
  const vacancy = asRecord(application.vacancy ?? application.job)
  const company = asRecord(vacancy?.company ?? application.company)
  const resume = asRecord(application.resume)
  const profession = asRecord(resume?.profession)
  const city = asRecord(vacancy?.city ?? application.city)

  const id =
    safeNumber(application.id) ??
    safeNumber(application.application_id) ??
    safeNumber(application.applicationId) ??
    index + 1

  const vacancyId =
    safeNumber(application.vacancy_id) ??
    safeNumber(application.vacancyId) ??
    safeNumber(vacancy?.id)

  const vacancyTitle =
    safeString(application.vacancy_title) ||
    safeString(application.vacancyTitle) ||
    safeString(vacancy?.title) ||
    safeString(vacancy?.name) ||
    'Вакансия без названия'

  const companyName =
    safeString(application.company_name) ||
    safeString(application.companyName) ||
    safeString(vacancy?.company_name) ||
    safeString(vacancy?.companyName) ||
    safeString(company?.name) ||
    'Компания не указана'

  const status = normalizeStatus(
    safeString(application.status) ||
      safeString(application.application_status) ||
      safeString(application.applicationStatus) ||
      safeString(application.state) ||
      'Отправлен',
  )

  const createdAt =
    safeString(application.created_at) ||
    safeString(application.createdAt) ||
    safeString(application.applied_at) ||
    safeString(application.appliedAt) ||
    null

  const updatedAt =
    safeString(application.updated_at) ||
    safeString(application.updatedAt) ||
    null

  const resumeTitle =
    safeString(application.resume_title) ||
    safeString(application.resumeTitle) ||
    safeString(profession?.name) ||
    safeString(resume?.title) ||
    safeString(resume?.name) ||
    'Резюме не указано'

  const locationText =
    safeString(application.city_name) ||
    safeString(application.cityName) ||
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
  const items = extractApplicationsArray(data)

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

  if (normalized.includes('отказ')) {
    return 'application-status application-status--rejected'
  }

  if (normalized.includes('рассмотр')) {
    return 'application-status application-status--review'
  }

  if (normalized.includes('полож')) {
    return 'application-status application-status--accepted'
  }

  return 'application-status application-status--sent'
}

const getVisiblePages = (totalPages: number, currentPage: number): Array<number | string> => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages: Array<number | string> = [1]
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) pages.push('left-dots')

  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  if (end < totalPages - 1) pages.push('right-dots')

  pages.push(totalPages)

  return pages
}

export const MyApplicationsPage = () => {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const applicationsQuery = useQuery({
    queryKey: ['applicant-my-applications'],
    queryFn: fetchMyApplications,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const applications = useMemo(() => applicationsQuery.data || [], [applicationsQuery.data])

  const stats = useMemo(() => {
    return {
      all: applications.length,
      sent: applications.filter((item) => getStatusFilter(item.status) === 'sent').length,
      review: applications.filter((item) => getStatusFilter(item.status) === 'review').length,
      accepted: applications.filter((item) => getStatusFilter(item.status) === 'accepted').length,
      rejected: applications.filter((item) => getStatusFilter(item.status) === 'rejected').length,
    }
  }, [applications])

  const filteredApplications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return applications.filter((application) => {
      const matchesStatus =
        statusFilter === 'all' || getStatusFilter(application.status) === statusFilter

      const matchesSearch =
        !normalizedSearch ||
        application.vacancyTitle.toLowerCase().includes(normalizedSearch) ||
        application.companyName.toLowerCase().includes(normalizedSearch) ||
        application.resumeTitle.toLowerCase().includes(normalizedSearch) ||
        application.locationText.toLowerCase().includes(normalizedSearch)

      return matchesStatus && matchesSearch
    })
  }, [applications, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / PAGE_SIZE))

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const paginatedApplications = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredApplications.slice(start, start + PAGE_SIZE)
  }, [filteredApplications, currentPage])

  const visiblePages = useMemo(() => {
    return getVisiblePages(totalPages, currentPage)
  }, [totalPages, currentPage])

  const hasFilters = search.trim() || statusFilter !== 'all'
  const hasPagination = filteredApplications.length > PAGE_SIZE

  const shownFrom =
    filteredApplications.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1

  const shownTo = Math.min(currentPage * PAGE_SIZE, filteredApplications.length)

  const getFilterCount = (filter: StatusFilter) => {
    return stats[filter]
  }

  return (
    <div className="my-applications-page">
      <Header />

      <main className="my-applications-page__main">
        <div className="my-applications-page__container">
          <section className="my-applications-shell">
            <div className="my-applications-hero">
              <div className="my-applications-hero__content">
                <span className="my-applications-hero__eyebrow">Личный кабинет</span>

                <h1 className="my-applications-hero__title">Мои отклики</h1>

                <p className="my-applications-hero__subtitle">
                  Отслеживайте статусы откликов, открывайте вакансии и быстро находите нужную
                  заявку по компании, резюме или городу.
                </p>
              </div>

              <button
                type="button"
                className="my-applications-btn my-applications-btn--primary"
                onClick={() => navigate('/vacancies')}
              >
                Найти вакансии
              </button>
            </div>

            <div className="my-applications-summary">
              <button
                type="button"
                className={`summary-tile ${statusFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                <span className="summary-tile__label">Всего</span>
                <strong className="summary-tile__value">{stats.all}</strong>
              </button>

              <button
                type="button"
                className={`summary-tile ${statusFilter === 'sent' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('sent')}
              >
                <span className="summary-tile__label">Отправлены</span>
                <strong className="summary-tile__value">{stats.sent}</strong>
              </button>

              <button
                type="button"
                className={`summary-tile ${statusFilter === 'review' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('review')}
              >
                <span className="summary-tile__label">На рассмотрении</span>
                <strong className="summary-tile__value">{stats.review}</strong>
              </button>

              <button
                type="button"
                className={`summary-tile ${statusFilter === 'accepted' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('accepted')}
              >
                <span className="summary-tile__label">Положительные</span>
                <strong className="summary-tile__value">{stats.accepted}</strong>
              </button>

              <button
                type="button"
                className={`summary-tile ${statusFilter === 'rejected' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('rejected')}
              >
                <span className="summary-tile__label">Отказы</span>
                <strong className="summary-tile__value">{stats.rejected}</strong>
              </button>
            </div>

            <div className="my-applications-toolbar">
              <label className="my-applications-search">
                <span className="my-applications-search__label">Поиск</span>

                <input
                  type="text"
                  placeholder="Вакансия, компания, резюме или город"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <div className="my-applications-filters" aria-label="Фильтр по статусу">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`my-applications-filter ${
                      statusFilter === filter.value ? 'is-active' : ''
                    }`}
                    onClick={() => setStatusFilter(filter.value)}
                  >
                    <span>{filter.label}</span>
                    <strong>{getFilterCount(filter.value)}</strong>
                  </button>
                ))}
              </div>

              {hasFilters && (
                <button
                  type="button"
                  className="my-applications-clear"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('all')
                  }}
                >
                  Сбросить фильтры
                </button>
              )}
            </div>

            {applicationsQuery.isLoading && (
              <div className="my-applications-list">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="application-card application-card--skeleton" />
                ))}
              </div>
            )}

            {applicationsQuery.isError && (
              <div className="my-applications-state my-applications-state--error">
                <h2>Не удалось загрузить отклики</h2>
                <p>Проверьте соединение или попробуйте обновить страницу.</p>
              </div>
            )}

            {!applicationsQuery.isLoading &&
              !applicationsQuery.isError &&
              applications.length === 0 && (
                <div className="my-applications-empty">
                  <h2>У вас пока нет откликов</h2>

                  <p>
                    Когда вы откликнетесь на вакансию, она появится здесь вместе со статусом и
                    деталями.
                  </p>

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
                <div className="my-applications-empty">
                  <h2>Ничего не найдено</h2>

                  <p>По текущему поиску и фильтрам откликов нет.</p>

                  <button
                    type="button"
                    className="my-applications-btn my-applications-btn--outline"
                    onClick={() => {
                      setSearch('')
                      setStatusFilter('all')
                    }}
                  >
                    Сбросить фильтры
                  </button>
                </div>
              )}

            {!applicationsQuery.isLoading &&
              !applicationsQuery.isError &&
              filteredApplications.length > 0 && (
                <>
                  <div className="my-applications-count">
                    Показано {shownFrom}–{shownTo} из {filteredApplications.length}
                  </div>

                  <div className="my-applications-list">
                    {paginatedApplications.map((application) => (
                      <article key={application.id} className="application-card">
                        <div className="application-card__head">
                          <div className="application-card__main">
                            <div className="application-card__company">
                              {application.companyName}
                            </div>

                            <h2 className="application-card__title">
                              {application.vacancyTitle}
                            </h2>
                          </div>

                          <div className={getStatusClassName(application.status)}>
                            {application.status}
                          </div>
                        </div>

                        <div className="application-card__facts">
                          <div className="application-fact">
                            <span className="application-fact__label">Резюме</span>
                            <span className="application-fact__value">
                              {application.resumeTitle}
                            </span>
                          </div>

                          <div className="application-fact">
                            <span className="application-fact__label">Локация</span>
                            <span className="application-fact__value">
                              {application.locationText}
                            </span>
                          </div>

                          <div className="application-fact">
                            <span className="application-fact__label">Зарплата</span>
                            <span className="application-fact__value">
                              {application.salaryText}
                            </span>
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

                  {hasPagination && (
                    <div className="my-applications-pagination" aria-label="Пагинация откликов">
                      <button
                        type="button"
                        className="my-applications-pagination__arrow"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      >
                        Назад
                      </button>

                      <div className="my-applications-pagination__pages">
                        {visiblePages.map((page) => {
                          if (typeof page === 'string') {
                            return (
                              <span key={page} className="my-applications-pagination__dots">
                                ...
                              </span>
                            )
                          }

                          return (
                            <button
                              key={page}
                              type="button"
                              className={`my-applications-pagination__page ${
                                currentPage === page ? 'is-active' : ''
                              }`}
                              onClick={() => setCurrentPage(page)}
                              aria-current={currentPage === page ? 'page' : undefined}
                            >
                              {page}
                            </button>
                          )
                        })}
                      </div>

                      <button
                        type="button"
                        className="my-applications-pagination__arrow"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      >
                        Вперёд
                      </button>
                    </div>
                  )}
                </>
              )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}