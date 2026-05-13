import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './company-applications.css'
type ApplicationStatus = 'pending' | 'accepted' | 'rejected'

type VacancyOption = {
  id: number
  title: string
}

type CatalogOption = {
  id: number
  name: string
}

type EmployerApplicationVacancy = {
  id: number
  title: string
  city_name?: string | null
  profession_name?: string | null
  salary_min?: number | null
  salary_max?: number | null
  currency?: string | null
  skills?: string[]
}

type EmployerApplicationApplicant = {
  id?: number | null
  full_name: string
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  city_name?: string | null
  age?: number | null
  gender?: string | null
  phone?: string | null
  photo?: string | null
}

type EmployerApplicationResume = {
  id: number
  profession_id?: number | null
  profession_name?: string | null
  title: string
  skills?: string[]
  experience_years?: number | null
  latest_position?: string | null
  latest_company?: string | null
  educations_count?: number
  work_experiences_count?: number
  created_at?: string | null
  updated_at?: string | null
}

type EmployerApplicationMatch = {
  score: number
  profession_score: number
  skills_score: number
  cover_letter_score: number
  city_score: number
  experience_score: number
  freshness_score: number
  suspicion_penalty: number
  matching_skills: string[]
  missing_skills: string[]
  skills_match_percent: number
}

type EmployerApplicationSuspicion = {
  period_days: number
  period_from?: string | null
  applications_count: number
  pending_count: number
  accepted_count: number
  rejected_count: number
  resume_changes_count: number
  applicant_resume_changes_count: number
  suspicion_score: number
  is_suspicious: boolean
  reasons: string[]
}

type EmployerApplicationItem = {
  id: number
  vacancy_id: number
  resume_id: number
  status: ApplicationStatus | string
  status_label: string
  cover_letter?: string | null
  has_cover_letter: boolean
  created_at?: string | null
  updated_at?: string | null
  vacancy: EmployerApplicationVacancy
  applicant: EmployerApplicationApplicant
  resume: EmployerApplicationResume
  match: EmployerApplicationMatch
  suspicion: EmployerApplicationSuspicion
}

type EmployerApplicationListResponse = {
  items: EmployerApplicationItem[]
  total: number
  stats: {
    total: number
    pending: number
    accepted: number
    rejected: number
    suspicious: number
    with_cover_letter: number
    average_match_score: number
  }
}

type ApiValidationItem = {
  msg?: string
  loc?: Array<string | number>
  type?: string
}

type ApiErrorResponse = {
  detail?: string | { message?: string; error?: string } | ApiValidationItem[]
  message?: string
  error?: string
}

type SelectOption = {
  value: string
  label: string
}

const PAGE_SIZE = 12

const statusOptions: SelectOption[] = [
  { value: '', label: 'Все статусы' },
  { value: 'pending', label: 'Новые' },
  { value: 'accepted', label: 'Собеседование' },
  { value: 'rejected', label: 'Отказ' },
]

const coverLetterOptions: SelectOption[] = [
  { value: '', label: 'Не важно' },
  { value: 'true', label: 'С письмом' },
  { value: 'false', label: 'Без письма' },
]

const suspiciousOptions: SelectOption[] = [
  { value: '', label: 'Все отклики' },
  { value: 'true', label: 'Только подозрительные' },
  { value: 'false', label: 'Без подозрительных' },
]

const sortOptions: SelectOption[] = [
  { value: 'smart', label: 'Умный подбор' },
  { value: 'new', label: 'Сначала новые' },
  { value: 'old', label: 'Сначала старые' },
  { value: 'suspicious', label: 'По подозрительности' },
]

const periodOptions: SelectOption[] = [
  { value: '7', label: '7 дней' },
  { value: '14', label: '14 дней' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
  { value: '180', label: '180 дней' },
]

const normalizeArrayResponse = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[]

  if (data && typeof data === 'object') {
    const objectData = data as {
      items?: unknown[]
      results?: unknown[]
      data?: unknown[]
    }

    if (Array.isArray(objectData.items)) return objectData.items as T[]
    if (Array.isArray(objectData.results)) return objectData.results as T[]
    if (Array.isArray(objectData.data)) return objectData.data as T[]
  }

  return []
}

const compactNumber = (value?: number | null) => {
  const number = Number(value ?? 0)

  if (!Number.isFinite(number) || number <= 0) return '0'
  if (number >= 1000000) return `${Math.floor(number / 1000000)}m+`
  if (number >= 10000) return `${Math.floor(number / 1000)}k+`

  return number.toLocaleString('ru-RU')
}

const formatSalary = (
  salaryMin?: number | null,
  salaryMax?: number | null,
  currency = 'BYN',
) => {
  const min = typeof salaryMin === 'number' && salaryMin > 0 ? salaryMin : null
  const max = typeof salaryMax === 'number' && salaryMax > 0 ? salaryMax : null

  if (min && max) {
    if (min === max) return `${min.toLocaleString('ru-RU')} ${currency}`
    return `${min.toLocaleString('ru-RU')} — ${max.toLocaleString('ru-RU')} ${currency}`
  }

  if (min) return `от ${min.toLocaleString('ru-RU')} ${currency}`
  if (max) return `до ${max.toLocaleString('ru-RU')} ${currency}`

  return 'Зарплата не указана'
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

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getStatusLabel = (status: string) => {
  if (status === 'accepted') return 'Собеседование'
  if (status === 'rejected') return 'Отказ'
  if (status === 'pending') return 'Новый отклик'

  return 'Неизвестно'
}

const getStatusClassName = (status: string) => {
  if (status === 'accepted') return 'is-accepted'
  if (status === 'rejected') return 'is-rejected'
  return 'is-pending'
}

const getScoreClassName = (score: number) => {
  if (score >= 75) return 'is-high'
  if (score >= 45) return 'is-medium'
  return 'is-low'
}

const translateApiMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase()

  if (lower.includes('отклик не найден') || lower.includes('application not found')) {
    return 'Отклик не найден.'
  }

  if (lower.includes('вакансия не найдена') || lower.includes('vacancy not found')) {
    return 'Вакансия не найдена.'
  }

  if (lower.includes('access') || lower.includes('доступ') || lower.includes('forbidden')) {
    return 'Недостаточно прав для выполнения действия.'
  }

  if (lower.includes('unauthorized') || lower.includes('not authenticated')) {
    return 'Сессия истекла. Войдите в аккаунт заново.'
  }

  if (status === 401) return 'Сессия истекла. Войдите в аккаунт заново.'
  if (status === 403) return 'Недостаточно прав для выполнения действия.'
  if (status === 404) return 'Данные не найдены.'
  if (status === 422) return 'Проверьте корректность данных.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  return message || 'Не удалось выполнить действие.'
}

const getErrorMessage = (error: unknown, fallback = 'Не удалось выполнить действие.') => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback

  const status = error.response?.status
  const data = error.response?.data

  if (!error.response) {
    return 'Нет соединения с сервером. Проверьте интернет или попробуйте позже.'
  }

  if (Array.isArray(data?.detail)) {
    const messages = data.detail
      .map((item) => translateApiMessage(item.msg || '', status))
      .filter(Boolean)

    if (messages.length) return messages[0]
  }

  if (typeof data?.detail === 'string') {
    return translateApiMessage(data.detail, status)
  }

  if (data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
    const message = data.detail.message || data.detail.error
    if (message) return translateApiMessage(message, status)
  }

  if (data?.message) return translateApiMessage(data.message, status)
  if (data?.error) return translateApiMessage(data.error, status)

  return fallback
}

const fetchEmployerApplications = async (params: Record<string, unknown>) => {
  const { data } = await http.get<EmployerApplicationListResponse>('/companies/me/applications', {
    params,
  })

  return {
    items: normalizeArrayResponse<EmployerApplicationItem>(data?.items),
    total: Number(data?.total ?? 0),
    stats: {
      total: Number(data?.stats?.total ?? data?.total ?? 0),
      pending: Number(data?.stats?.pending ?? 0),
      accepted: Number(data?.stats?.accepted ?? 0),
      rejected: Number(data?.stats?.rejected ?? 0),
      suspicious: Number(data?.stats?.suspicious ?? 0),
      with_cover_letter: Number(data?.stats?.with_cover_letter ?? 0),
      average_match_score: Number(data?.stats?.average_match_score ?? 0),
    },
  }
}

const fetchApplicationDetail = async (applicationId: number, periodDays: number) => {
  const { data } = await http.get<EmployerApplicationItem>(
    `/companies/me/applications/${applicationId}`,
    {
      params: {
        period_days: periodDays,
      },
    },
  )

  return data
}

const updateApplicationStatus = async ({
  applicationId,
  status,
  periodDays,
}: {
  applicationId: number
  status: ApplicationStatus
  periodDays: number
}) => {
  const { data } = await http.patch<EmployerApplicationItem>(
    `/companies/me/applications/${applicationId}/status`,
    { status },
    {
      params: {
        period_days: periodDays,
      },
    },
  )

  return data
}

const fetchMyVacancies = async () => {
  const { data } = await http.get('/companies/me/vacancies', {
    params: {
      skip: 0,
      limit: 100,
    },
  })

  return normalizeArrayResponse<VacancyOption>(data)
}

const fetchCatalog = async <T,>(name: string): Promise<T[]> => {
  const { data } = await http.get(`/public/catalogs/${name}`, {
    params: {
      skip: 0,
      limit: 100,
    },
  })

  return normalizeArrayResponse<T>(data)
}

const fetchProfessions = async (): Promise<CatalogOption[]> => {
  const { data } = await http.get('/public/professions', {
    params: {
      skip: 0,
      limit: 100,
    },
  })

  return normalizeArrayResponse<CatalogOption>(data)
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`employer-select__icon ${open ? 'is-open' : ''}`}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M6 9L12 15L18 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

type SelectProps = {
  label: string
  value: string
  placeholder?: string
  options: SelectOption[]
  openKey: string
  activeOpenKey: string | null
  onOpenChange: (value: string | null) => void
  onChange: (value: string) => void
}

const SelectField = ({
  label,
  value,
  placeholder = 'Выберите',
  options,
  openKey,
  activeOpenKey,
  onOpenChange,
  onChange,
}: SelectProps) => {
  const isOpen = activeOpenKey === openKey
  const currentLabel = options.find((item) => item.value === value)?.label || placeholder

  return (
    <label className="employer-field">
      <span>{label}</span>

      <div className={`employer-select ${isOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className={`employer-select__trigger ${isOpen ? 'is-open' : ''}`}
          onClick={() => onOpenChange(isOpen ? null : openKey)}
          aria-expanded={isOpen}
        >
          <span className={value ? 'is-value' : 'is-placeholder'}>{currentLabel}</span>
          <ChevronIcon open={isOpen} />
        </button>

        {isOpen ? (
          <div className="employer-select__dropdown">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`employer-select__option ${
                  option.value === value ? 'is-active' : ''
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value)
                  onOpenChange(null)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  )
}

type SearchSelectProps = {
  label: string
  value: string
  search: string
  placeholder: string
  options: SelectOption[]
  openKey: string
  activeOpenKey: string | null
  emptyText?: string
  onOpenChange: (value: string | null) => void
  onSearchChange: (value: string) => void
  onValueReset: () => void
  onSelect: (option: SelectOption) => void
}

const SearchSelectField = ({
  label,
  value,
  search,
  placeholder,
  options,
  openKey,
  activeOpenKey,
  emptyText = 'Ничего не найдено',
  onOpenChange,
  onSearchChange,
  onValueReset,
  onSelect,
}: SearchSelectProps) => {
  const isOpen = activeOpenKey === openKey

  return (
    <div className="employer-field">
      <span>{label}</span>

      <div className={`employer-combo ${isOpen ? 'is-open' : ''}`}>
        <input
          value={search}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => onOpenChange(openKey)}
          onChange={(event) => {
            onSearchChange(event.target.value)

            if (value) {
              onValueReset()
            }

            onOpenChange(openKey)
          }}
        />

        {search || value ? (
          <button
            type="button"
            className="employer-combo__clear"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onSearchChange('')
              onValueReset()
              onOpenChange(null)
            }}
            aria-label="Очистить"
          >
            ×
          </button>
        ) : null}

        {isOpen ? (
          <div className="employer-combo__dropdown">
            {options.length > 0 ? (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`employer-combo__option ${
                    option.value === value ? 'is-active' : ''
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(option)
                    onOpenChange(null)
                  }}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="employer-combo__empty">{emptyText}</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`employer-status ${getStatusClassName(status)}`}>{getStatusLabel(status)}</span>
)

const ScoreBadge = ({ score }: { score: number }) => (
  <div className={`employer-score ${getScoreClassName(score)}`}>
    <strong>{score}%</strong>
    <span>совпадение</span>
  </div>
)

const ApplicationCard = ({
  item,
  onOpen,
  onStatusChange,
  isStatusPending,
}: {
  item: EmployerApplicationItem
  onOpen: (item: EmployerApplicationItem) => void
  onStatusChange: (id: number, status: ApplicationStatus) => void
  isStatusPending: boolean
}) => {
  const applicantInitial = item.applicant.full_name?.slice(0, 1).toUpperCase() || 'С'

  return (
    <article className="employer-application-card">
      <div className="employer-application-card__top">
        <div className="employer-application-card__person">
          {item.applicant.photo ? (
            <img
              className="employer-application-card__avatar"
              src={item.applicant.photo}
              alt={item.applicant.full_name}
            />
          ) : (
            <div className="employer-application-card__avatar employer-application-card__avatar--placeholder">
              {applicantInitial}
            </div>
          )}

          <div className="employer-application-card__person-text">
            <h3>{item.applicant.full_name}</h3>
            <p>{item.resume.profession_name || item.resume.title}</p>
          </div>
        </div>

        <ScoreBadge score={item.match.score} />
      </div>

      <div className="employer-application-card__vacancy">
        <span>Отклик на вакансию</span>
        <strong>{item.vacancy.title}</strong>
      </div>

      <div className="employer-application-card__meta">
        <span>{item.applicant.city_name || 'Город не указан'}</span>
        <span>
          {typeof item.applicant.age === 'number'
            ? `${item.applicant.age} лет`
            : 'Возраст не указан'}
        </span>
        <span>
          {Number(item.resume.experience_years || 0) > 0
            ? `${item.resume.experience_years} г. опыта`
            : 'Без опыта'}
        </span>
        <span>{formatDate(item.created_at)}</span>
      </div>

      <div className="employer-application-card__chips">
        <StatusBadge status={item.status} />

        {item.has_cover_letter ? (
          <span className="employer-chip employer-chip--cover">Есть письмо</span>
        ) : (
          <span className="employer-chip">Без письма</span>
        )}

        {item.suspicion.is_suspicious ? (
          <span className="employer-chip employer-chip--danger">
            Подозрительность {item.suspicion.suspicion_score}%
          </span>
        ) : (
          <span className="employer-chip employer-chip--safe">Проверка пройдена</span>
        )}
      </div>

      {item.match.matching_skills.length > 0 ? (
        <div className="employer-application-card__skills">
          {item.match.matching_skills.slice(0, 6).map((skill) => (
            <span key={skill}>{skill}</span>
          ))}

          {item.match.matching_skills.length > 6 ? (
            <span>+{item.match.matching_skills.length - 6}</span>
          ) : null}
        </div>
      ) : (
        <p className="employer-application-card__empty">
          Совпадающие навыки не найдены.
        </p>
      )}

      <div className="employer-application-card__bottom">
        <button
          type="button"
          className="employer-btn employer-btn--outline"
          onClick={() => onOpen(item)}
        >
          Подробнее
        </button>

        <div className="employer-application-card__status-actions">
          <button
            type="button"
            className="employer-btn employer-btn--success"
            disabled={isStatusPending || item.status === 'accepted'}
            onClick={() => onStatusChange(item.id, 'accepted')}
          >
            Пригласить
          </button>

          <button
            type="button"
            className="employer-btn employer-btn--danger"
            disabled={isStatusPending || item.status === 'rejected'}
            onClick={() => onStatusChange(item.id, 'rejected')}
          >
            Отказать
          </button>
        </div>
      </div>
    </article>
  )
}

const DetailModal = ({
  item,
  onClose,
  onStatusChange,
  isStatusPending,
}: {
  item: EmployerApplicationItem
  onClose: () => void
  onStatusChange: (id: number, status: ApplicationStatus) => void
  isStatusPending: boolean
}) => {
  const applicantInitial = item.applicant.full_name?.slice(0, 1).toUpperCase() || 'С'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div className="employer-modal-overlay" onMouseDown={onClose}>
      <section
        className="employer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="employer-modal__header">
          <div className="employer-modal__person">
            {item.applicant.photo ? (
              <img src={item.applicant.photo} alt={item.applicant.full_name} />
            ) : (
              <div>{applicantInitial}</div>
            )}

            <div>
              <p>Карточка отклика</p>
              <h2 id="application-detail-title">{item.applicant.full_name}</h2>
              <span>{item.resume.profession_name || item.resume.title}</span>
            </div>
          </div>

          <button
            type="button"
            className="employer-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="employer-modal__summary">
          <ScoreBadge score={item.match.score} />

          <div>
            <span>Статус</span>
            <StatusBadge status={item.status} />
          </div>

          <div>
            <span>Подозрительность</span>
            <strong className={item.suspicion.is_suspicious ? 'is-danger' : 'is-safe'}>
              {item.suspicion.suspicion_score}%
            </strong>
          </div>

          <div>
            <span>Дата отклика</span>
            <strong>{formatDateTime(item.created_at)}</strong>
          </div>
        </div>

        <div className="employer-modal__grid">
          <article className="employer-modal-card">
            <h3>Кандидат</h3>

            <div className="employer-modal-list">
              <div>
                <span>Город</span>
                <strong>{item.applicant.city_name || 'Не указан'}</strong>
              </div>

              <div>
                <span>Возраст</span>
                <strong>
                  {typeof item.applicant.age === 'number'
                    ? `${item.applicant.age} лет`
                    : 'Не указан'}
                </strong>
              </div>

              <div>
                <span>Телефон</span>
                <strong>{item.applicant.phone || 'Не указан'}</strong>
              </div>

              <div>
                <span>Опыт</span>
                <strong>
                  {Number(item.resume.experience_years || 0) > 0
                    ? `${item.resume.experience_years} г.`
                    : 'Без опыта'}
                </strong>
              </div>

              <div>
                <span>Последняя должность</span>
                <strong>{item.resume.latest_position || 'Не указана'}</strong>
              </div>

              <div>
                <span>Последняя компания</span>
                <strong>{item.resume.latest_company || 'Не указана'}</strong>
              </div>
            </div>

            <Link
              to={`/company/resumes/${item.resume.id}`}
              target="_blank"
              rel="noreferrer"
              className="employer-modal-link"
            >
              Открыть резюме
            </Link>
          </article>

          <article className="employer-modal-card">
            <h3>Вакансия</h3>

            <div className="employer-modal-list">
              <div>
                <span>Название</span>
                <strong>{item.vacancy.title}</strong>
              </div>

              <div>
                <span>Профессия</span>
                <strong>{item.vacancy.profession_name || 'Не указана'}</strong>
              </div>

              <div>
                <span>Город</span>
                <strong>{item.vacancy.city_name || 'Не указан'}</strong>
              </div>

              <div>
                <span>Зарплата</span>
                <strong>
                  {formatSalary(
                    item.vacancy.salary_min,
                    item.vacancy.salary_max,
                    item.vacancy.currency || 'BYN',
                  )}
                </strong>
              </div>
            </div>
          </article>
        </div>

        <article className="employer-modal-card">
          <h3>Сопроводительное письмо</h3>

          {item.cover_letter ? (
            <p className="employer-cover-letter">{item.cover_letter}</p>
          ) : (
            <p className="employer-muted-text">Кандидат не добавил сопроводительное письмо.</p>
          )}
        </article>

        <div className="employer-modal__grid">
          <article className="employer-modal-card">
            <h3>Совпадающие навыки</h3>

            {item.match.matching_skills.length > 0 ? (
              <div className="employer-skill-list employer-skill-list--good">
                {item.match.matching_skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            ) : (
              <p className="employer-muted-text">Нет совпадающих навыков.</p>
            )}
          </article>

          <article className="employer-modal-card">
            <h3>Недостающие навыки</h3>

            {item.match.missing_skills.length > 0 ? (
              <div className="employer-skill-list employer-skill-list--bad">
                {item.match.missing_skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            ) : (
              <p className="employer-muted-text">Все ключевые навыки закрыты.</p>
            )}
          </article>
        </div>

        <article className="employer-modal-card">
          <h3>Проверка подозрительности</h3>

          <div className="employer-suspicion-grid">
            <div>
              <strong>{item.suspicion.applications_count}</strong>
              <span>откликов за период</span>
            </div>

            <div>
              <strong>{item.suspicion.resume_changes_count}</strong>
              <span>изменений резюме</span>
            </div>

            <div>
              <strong>{item.suspicion.rejected_count}</strong>
              <span>отказов</span>
            </div>

            <div>
              <strong>{item.suspicion.accepted_count}</strong>
              <span>приглашений</span>
            </div>
          </div>

          {item.suspicion.reasons.length > 0 ? (
            <div className="employer-reasons">
              {item.suspicion.reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          ) : (
            <p className="employer-muted-text">
              Критичных признаков подозрительности не найдено.
            </p>
          )}
        </article>

        <div className="employer-modal__footer">
          <button
            type="button"
            className="employer-btn employer-btn--outline"
            onClick={onClose}
          >
            Закрыть
          </button>

          <button
            type="button"
            className="employer-btn employer-btn--success"
            disabled={isStatusPending || item.status === 'accepted'}
            onClick={() => onStatusChange(item.id, 'accepted')}
          >
            Пригласить
          </button>

          <button
            type="button"
            className="employer-btn employer-btn--danger"
            disabled={isStatusPending || item.status === 'rejected'}
            onClick={() => onStatusChange(item.id, 'rejected')}
          >
            Отказать
          </button>
        </div>
      </section>
    </div>
  )
}

export const CompanyApplicationsPage = () => {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [statusFilter, setStatusFilter] = useState('')
  const [vacancyId, setVacancyId] = useState('')
  const [cityId, setCityId] = useState('')
  const [professionId, setProfessionId] = useState('')
  const [skillId, setSkillId] = useState('')
  const [hasCoverLetter, setHasCoverLetter] = useState('')
  const [suspiciousOnly, setSuspiciousOnly] = useState('')
  const [scoreFrom, setScoreFrom] = useState('')
  const [scoreTo, setScoreTo] = useState('')
  const [periodDays, setPeriodDays] = useState('30')
  const [sortBy, setSortBy] = useState('smart')

  const [citySearch, setCitySearch] = useState('')
  const [professionSearch, setProfessionSearch] = useState('')
  const [skillSearch, setSkillSearch] = useState('')

  const [openSelect, setOpenSelect] = useState<string | null>(null)
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      if (!target.closest('.employer-select') && !target.closest('.employer-combo')) {
        setOpenSelect(null)
      }
    }

    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [
    statusFilter,
    vacancyId,
    cityId,
    professionId,
    skillId,
    hasCoverLetter,
    suspiciousOnly,
    scoreFrom,
    scoreTo,
    periodDays,
    sortBy,
  ])

  useEffect(() => {
    if (!notice) return

    const timeout = window.setTimeout(() => {
      setNotice(null)
    }, 3200)

    return () => window.clearTimeout(timeout)
  }, [notice])

  const vacanciesQuery = useQuery({
    queryKey: ['company-vacancies-options'],
    queryFn: fetchMyVacancies,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const citiesQuery = useQuery({
    queryKey: ['public-cities', 'company-applications'],
    queryFn: () => fetchCatalog<CatalogOption>('cities'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const professionsQuery = useQuery({
    queryKey: ['public-professions', 'company-applications'],
    queryFn: fetchProfessions,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const skillsQuery = useQuery({
    queryKey: ['public-skills', 'company-applications'],
    queryFn: () => fetchCatalog<CatalogOption>('skills'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const vacancyOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: '', label: 'Все вакансии' },
      ...(vacanciesQuery.data || []).map((item) => ({
        value: String(item.id),
        label: item.title,
      })),
    ]
  }, [vacanciesQuery.data])

  const filteredCityOptions = useMemo<SelectOption[]>(() => {
    const value = citySearch.trim().toLowerCase()

    return (citiesQuery.data || [])
      .filter((item) => !value || item.name.toLowerCase().includes(value))
      .slice(0, 40)
      .map((item) => ({
        value: String(item.id),
        label: item.name,
      }))
  }, [citiesQuery.data, citySearch])

  const filteredProfessionOptions = useMemo<SelectOption[]>(() => {
    const value = professionSearch.trim().toLowerCase()

    return (professionsQuery.data || [])
      .filter((item) => !value || item.name.toLowerCase().includes(value))
      .slice(0, 40)
      .map((item) => ({
        value: String(item.id),
        label: item.name,
      }))
  }, [professionsQuery.data, professionSearch])

  const filteredSkillOptions = useMemo<SelectOption[]>(() => {
    const value = skillSearch.trim().toLowerCase()

    return (skillsQuery.data || [])
      .filter((item) => !value || item.name.toLowerCase().includes(value))
      .slice(0, 40)
      .map((item) => ({
        value: String(item.id),
        label: item.name,
      }))
  }, [skillsQuery.data, skillSearch])

  const listParams = useMemo(() => {
    const params: Record<string, unknown> = {
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      period_days: Number(periodDays),
      sort_by: sortBy,
    }

    if (debouncedSearch) params.search = debouncedSearch
    if (statusFilter) params.status = statusFilter
    if (vacancyId) params.vacancy_id = Number(vacancyId)
    if (cityId) params.city_id = Number(cityId)
    if (professionId) params.profession_id = Number(professionId)
    if (skillId) params.skill_id = Number(skillId)
    if (hasCoverLetter) params.has_cover_letter = hasCoverLetter === 'true'
    if (suspiciousOnly) params.suspicious_only = suspiciousOnly === 'true'
    if (scoreFrom) params.score_from = Number(scoreFrom)
    if (scoreTo) params.score_to = Number(scoreTo)

    return params
  }, [
    page,
    periodDays,
    sortBy,
    debouncedSearch,
    statusFilter,
    vacancyId,
    cityId,
    professionId,
    skillId,
    hasCoverLetter,
    suspiciousOnly,
    scoreFrom,
    scoreTo,
  ])

  const applicationsQuery = useQuery({
    queryKey: ['company-applications-page', listParams],
    queryFn: () => fetchEmployerApplications(listParams),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const detailQuery = useQuery({
    queryKey: ['company-application-detail', selectedApplicationId, periodDays],
    queryFn: () => fetchApplicationDetail(selectedApplicationId as number, Number(periodDays)),
    enabled: Boolean(selectedApplicationId),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const statusMutation = useMutation({
    mutationFn: updateApplicationStatus,
    onSuccess: async (updated) => {
      setNotice({
        type: 'success',
        text: `Статус изменён: ${getStatusLabel(updated.status)}.`,
      })

      await queryClient.invalidateQueries({
        queryKey: ['company-applications-page'],
      })

      await queryClient.invalidateQueries({
        queryKey: ['company-application-detail', updated.id],
      })
    },
    onError: (error) => {
      setNotice({
        type: 'error',
        text: getErrorMessage(error, 'Не удалось изменить статус отклика.'),
      })
    },
  })

  const applications = applicationsQuery.data?.items || []
  const total = applicationsQuery.data?.total || 0
  const stats = applicationsQuery.data?.stats
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)

  const selectedApplication = detailQuery.data || applications.find(
    (item) => item.id === selectedApplicationId,
  )

  const activeFiltersCount = [
    debouncedSearch,
    statusFilter,
    vacancyId,
    cityId,
    professionId,
    skillId,
    hasCoverLetter,
    suspiciousOnly,
    scoreFrom,
    scoreTo,
  ].filter(Boolean).length

  const resetFilters = () => {
    setPage(1)
    setSearch('')
    setDebouncedSearch('')
    setStatusFilter('')
    setVacancyId('')
    setCityId('')
    setProfessionId('')
    setSkillId('')
    setHasCoverLetter('')
    setSuspiciousOnly('')
    setScoreFrom('')
    setScoreTo('')
    setSortBy('smart')
    setPeriodDays('30')
    setCitySearch('')
    setProfessionSearch('')
    setSkillSearch('')
    setOpenSelect(null)
  }

  const handleStatusChange = (applicationId: number, nextStatus: ApplicationStatus) => {
    statusMutation.mutate({
      applicationId,
      status: nextStatus,
      periodDays: Number(periodDays),
    })
  }

  return (
    <div className="company-applications-page">
      <Header />

      <main className="company-applications-page__main">
        <section className="company-applications-hero">
          <div className="company-applications-container">
            <div className="company-applications-hero__card">
              <div>
                <span className="company-applications-eyebrow">Отклики работодателя</span>
              </div>

              <div className="company-applications-hero__stats">
                <div>
                  <strong>{compactNumber(stats?.total)}</strong>
                  <span>Всего</span>
                </div>

                <div>
                  <strong>{compactNumber(stats?.pending)}</strong>
                  <span>Новые</span>
                </div>

                <div>
                  <strong>{compactNumber(stats?.average_match_score)}%</strong>
                  <span>Средний процент совпадения</span>
                </div>

                <div>
                  <strong>{compactNumber(stats?.suspicious)}</strong>
                  <span>Подозрительные</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="company-applications-content">
          <div className="company-applications-container">
            {notice ? (
              <div
                className={`company-applications-notice ${
                  notice.type === 'success'
                    ? 'company-applications-notice--success'
                    : 'company-applications-notice--error'
                }`}
              >
                {notice.text}
              </div>
            ) : null}

            <div className="company-applications-layout">
              <aside className="company-applications-sidebar">
                <div className="company-applications-filter-card">
                  <div className="company-applications-filter-card__header">
                    <div>
                      <h2>Фильтры</h2>
                      <p>
                        Активно: <strong>{activeFiltersCount}</strong>
                      </p>
                    </div>

                    <button type="button" onClick={resetFilters}>
                      Сбросить
                    </button>
                  </div>

                  <label className="employer-field">
                    <span>Поиск</span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Имя, вакансия, навык..."
                    />
                  </label>

                  <SelectField
                    label="Вакансия"
                    value={vacancyId}
                    options={vacancyOptions}
                    openKey="vacancy"
                    activeOpenKey={openSelect}
                    onOpenChange={setOpenSelect}
                    onChange={setVacancyId}
                  />

                  <SelectField
                    label="Статус"
                    value={statusFilter}
                    options={statusOptions}
                    openKey="status"
                    activeOpenKey={openSelect}
                    onOpenChange={setOpenSelect}
                    onChange={setStatusFilter}
                  />

                  <SelectField
                    label="Сопроводительное"
                    value={hasCoverLetter}
                    options={coverLetterOptions}
                    openKey="cover"
                    activeOpenKey={openSelect}
                    onOpenChange={setOpenSelect}
                    onChange={setHasCoverLetter}
                  />

                  <SelectField
                    label="Подозрительность"
                    value={suspiciousOnly}
                    options={suspiciousOptions}
                    openKey="suspicious"
                    activeOpenKey={openSelect}
                    onOpenChange={setOpenSelect}
                    onChange={setSuspiciousOnly}
                  />

                 <SearchSelectField
  label="Город кандидата"
  value={cityId}
  search={citySearch}
  placeholder="Поиск города"
  options={filteredCityOptions}
  openKey="city"
  activeOpenKey={openSelect}
  onOpenChange={setOpenSelect}
  onSearchChange={setCitySearch}
  onValueReset={() => setCityId('')}
  onSelect={(option) => {
    setCityId(option.value)
    setCitySearch(option.label)
  }}
/>

                  <SearchSelectField
  label="Профессия"
  value={professionId}
  search={professionSearch}
  placeholder="Поиск профессии"
  options={filteredProfessionOptions}
  openKey="profession"
  activeOpenKey={openSelect}
  onOpenChange={setOpenSelect}
  onSearchChange={setProfessionSearch}
  onValueReset={() => setProfessionId('')}
  onSelect={(option) => {
    setProfessionId(option.value)
    setProfessionSearch(option.label)
  }}
/>

                  <SearchSelectField
  label="Навык"
  value={skillId}
  search={skillSearch}
  placeholder="Поиск навыка"
  options={filteredSkillOptions}
  openKey="skill"
  activeOpenKey={openSelect}
  onOpenChange={setOpenSelect}
  onSearchChange={setSkillSearch}
  onValueReset={() => setSkillId('')}
  onSelect={(option) => {
    setSkillId(option.value)
    setSkillSearch(option.label)
  }}
/>

                  <div className="company-applications-filter-row">
                    <label className="employer-field">
                      <span>Совпадение от</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={scoreFrom}
                        onChange={(event) => setScoreFrom(event.target.value)}
                        placeholder="0"
                      />
                    </label>

                    <label className="employer-field">
                      <span>Совпадение до</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={scoreTo}
                        onChange={(event) => setScoreTo(event.target.value)}
                        placeholder="100"
                      />
                    </label>
                  </div>

                  <SelectField
                    label="Период проверки"
                    value={periodDays}
                    options={periodOptions}
                    openKey="period"
                    activeOpenKey={openSelect}
                    onOpenChange={setOpenSelect}
                    onChange={setPeriodDays}
                  />

                  <SelectField
                    label="Сортировка"
                    value={sortBy}
                    options={sortOptions}
                    openKey="sort"
                    activeOpenKey={openSelect}
                    onOpenChange={setOpenSelect}
                    onChange={setSortBy}
                  />
                </div>
              </aside>

              <section className="company-applications-main">
                <div className="company-applications-toolbar">
                  <div>
                    <span className="company-applications-eyebrow">Список откликов</span>
                    <h2>Найдено {total.toLocaleString('ru-RU')}</h2>
                  </div>

                  <div className="company-applications-toolbar__badges">
                    <span>{compactNumber(stats?.with_cover_letter)} с письмом</span>
                    <span>{compactNumber(stats?.accepted)} приглашены</span>
                    <span>{compactNumber(stats?.rejected)} отказ</span>
                  </div>
                </div>

                {applicationsQuery.isLoading ? (
                  <div className="company-applications-grid">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className="employer-application-card employer-application-card--skeleton"
                      />
                    ))}
                  </div>
                ) : null}

                {applicationsQuery.isError ? (
                  <div className="company-applications-empty company-applications-empty--error">
                    <h3>Не удалось загрузить отклики</h3>
                    <p>{getErrorMessage(applicationsQuery.error)}</p>
                    <button type="button" onClick={() => applicationsQuery.refetch()}>
                      Повторить
                    </button>
                  </div>
                ) : null}

                {!applicationsQuery.isLoading && !applicationsQuery.isError && applications.length === 0 ? (
                  <div className="company-applications-empty">
                    <h3>Отклики не найдены</h3>
                    <p>
                      Попробуйте изменить фильтры или дождитесь новых откликов от кандидатов.
                    </p>
                    <button type="button" onClick={resetFilters}>
                      Сбросить фильтры
                    </button>
                  </div>
                ) : null}

                {!applicationsQuery.isLoading && !applicationsQuery.isError && applications.length > 0 ? (
                  <>
                    <div className="company-applications-grid">
                      {applications.map((item) => (
                        <ApplicationCard
                          key={item.id}
                          item={item}
                          onOpen={(application) => setSelectedApplicationId(application.id)}
                          onStatusChange={handleStatusChange}
                          isStatusPending={statusMutation.isPending}
                        />
                      ))}
                    </div>

                    <div className="company-applications-pagination">
                      <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                      >
                        Назад
                      </button>

                      <span>
                        {page} / {totalPages}
                      </span>

                      <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                      >
                        Вперёд
                      </button>
                    </div>
                  </>
                ) : null}
              </section>
            </div>
          </div>
        </section>
      </main>

      {selectedApplicationId && selectedApplication ? (
        <DetailModal
          item={selectedApplication}
          onClose={() => setSelectedApplicationId(null)}
          onStatusChange={handleStatusChange}
          isStatusPending={statusMutation.isPending}
        />
      ) : null}

      <Footer />
    </div>
  )
}