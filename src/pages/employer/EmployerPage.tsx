import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import './employer.css'

type CatalogItem = {
  id: number
  name: string
}

type Vacancy = {
  id: number
  title: string
  description: string
  profession_id: number
  city_id: number
  employment_type_id: number
  work_schedule_id: number
  salary_min: number
  salary_max: number
  currency_id: number
  experience_id: number
  status_id: number
  company_id: number
  created_at: string
  updated_at: string
}

type CompanyProfile = {
  id: number
  name: string
  description?: string | null
  website?: string | null
  logo?: string | null
  founded_year?: number | null
  employee_count?: number | null
  vacancies: Vacancy[]
}

type ApplicationItem = {
  vacancy_id: number
  resume_id: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at?: string | null
  updated_at?: string | null
}

const fetchCatalog = async (name: string): Promise<CatalogItem[]> => {
  const { data } = await http.get(`/public/catalogs/${name}`, { params: { skip: 0, limit: 200 } })
  return data
}

const fetchProfile = async (): Promise<CompanyProfile> => {
  const { data } = await http.get('/companies/me')
  return data
}

const fetchVacancies = async (): Promise<Vacancy[]> => {
  const { data } = await http.get('/companies/me/vacancies', { params: { skip: 0, limit: 100 } })
  return data
}

const fetchApplications = async (vacancyId: number): Promise<ApplicationItem[]> => {
  const { data } = await http.get(`/companies/me/vacancies/${vacancyId}/applications`, {
    params: { skip: 0, limit: 100 },
  })
  return data
}

const defaultVacancyForm = {
  title: '',
  description: '',
  profession_id: '',
  city_id: '',
  employment_type_id: '',
  work_schedule_id: '',
  salary_min: '',
  salary_max: '',
  currency_id: '',
  experience_id: '',
}

export const EmployerPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const profileQuery = useQuery({ queryKey: ['company-profile'], queryFn: fetchProfile })
  const vacanciesQuery = useQuery({ queryKey: ['company-vacancies'], queryFn: fetchVacancies })
  const citiesQuery = useQuery({ queryKey: ['employer-cities'], queryFn: () => fetchCatalog('cities') })
  const professionsQuery = useQuery({ queryKey: ['employer-professions'], queryFn: () => fetchCatalog('professions') })
  const employmentTypesQuery = useQuery({
    queryKey: ['employer-employment-types'],
    queryFn: () => fetchCatalog('employment-types'),
  })
  const workSchedulesQuery = useQuery({
    queryKey: ['employer-work-schedules'],
    queryFn: () => fetchCatalog('work-schedules'),
  })
  const currenciesQuery = useQuery({ queryKey: ['employer-currencies'], queryFn: () => fetchCatalog('currencies') })
  const experiencesQuery = useQuery({ queryKey: ['employer-experiences'], queryFn: () => fetchCatalog('experiences') })

  const [profileForm, setProfileForm] = useState({
    name: '',
    description: '',
    website: '',
    logo: '',
    founded_year: '',
    employee_count: '',
  })
  const [profileTouched, setProfileTouched] = useState(false)
  const [vacancyForm, setVacancyForm] = useState(defaultVacancyForm)
  const [selectedVacancyId, setSelectedVacancyId] = useState<number | null>(null)
  const [message, setMessage] = useState('Управляйте профилем компании, вакансиями и откликами в одном кабинете.')

  const vacancies = vacanciesQuery.data ?? profileQuery.data?.vacancies ?? []
  const selectedVacancy = useMemo(
    () => vacancies.find((item) => item.id === selectedVacancyId) ?? vacancies[0] ?? null,
    [selectedVacancyId, vacancies],
  )

  const applicationsQuery = useQuery({
    queryKey: ['company-applications', selectedVacancy?.id],
    enabled: Boolean(selectedVacancy?.id),
    queryFn: () => fetchApplications(selectedVacancy!.id),
  })

  useEffect(() => {
    const profile = profileQuery.data
    if (!profile || profileTouched) return

    setProfileForm({
      name: profile.name ?? '',
      description: profile.description ?? '',
      website: profile.website ?? '',
      logo: profile.logo ?? '',
      founded_year: profile.founded_year ? String(profile.founded_year) : '',
      employee_count: profile.employee_count ? String(profile.employee_count) : '',
    })
  }, [profileQuery.data, profileTouched])

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      await http.put('/companies/me', {
        name: profileForm.name.trim(),
        description: profileForm.description.trim() || null,
        website: profileForm.website.trim() || null,
        logo: profileForm.logo.trim() || null,
        founded_year: profileForm.founded_year ? Number(profileForm.founded_year) : null,
        employee_count: profileForm.employee_count ? Number(profileForm.employee_count) : null,
      })
    },
    onSuccess: async () => {
      setMessage('Профиль компании обновлен.')
      await queryClient.invalidateQueries({ queryKey: ['company-profile'] })
    },
    onError: () => {
      setMessage('Не удалось обновить профиль компании.')
    },
  })

  const createVacancyMutation = useMutation({
    mutationFn: async () => {
      await http.post('/companies/me/vacancies', {
        title: vacancyForm.title.trim(),
        description: vacancyForm.description.trim(),
        profession_id: Number(vacancyForm.profession_id),
        city_id: Number(vacancyForm.city_id),
        employment_type_id: Number(vacancyForm.employment_type_id),
        work_schedule_id: Number(vacancyForm.work_schedule_id),
        salary_min: Number(vacancyForm.salary_min),
        salary_max: Number(vacancyForm.salary_max),
        currency_id: Number(vacancyForm.currency_id),
        experience_id: Number(vacancyForm.experience_id),
      })
    },
    onSuccess: async () => {
      setMessage('Вакансия создана.')
      setVacancyForm(defaultVacancyForm)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['company-vacancies'] }),
        queryClient.invalidateQueries({ queryKey: ['company-profile'] }),
      ])
    },
    onError: () => {
      setMessage('Не удалось создать вакансию. Проверьте поля формы.')
    },
  })

  const deleteVacancyMutation = useMutation({
    mutationFn: async (vacancyId: number) => {
      await http.delete(`/companies/me/vacancies/${vacancyId}`)
    },
    onSuccess: async (_, vacancyId) => {
      if (selectedVacancyId === vacancyId) {
        setSelectedVacancyId(null)
      }
      setMessage('Вакансия удалена.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['company-vacancies'] }),
        queryClient.invalidateQueries({ queryKey: ['company-profile'] }),
      ])
    },
    onError: () => {
      setMessage('Не удалось удалить вакансию.')
    },
  })

  const updateApplicationStatusMutation = useMutation({
    mutationFn: async (params: { vacancyId: number; resumeId: number; status: ApplicationItem['status'] }) => {
      await http.patch(`/companies/me/vacancies/${params.vacancyId}/applications/${params.resumeId}`, {
        status: params.status,
      })
    },
    onSuccess: async () => {
      setMessage('Статус отклика обновлен.')
      await queryClient.invalidateQueries({ queryKey: ['company-applications', selectedVacancy?.id] })
    },
    onError: () => {
      setMessage('Не удалось обновить статус отклика.')
    },
  })

  return (
    <div className="dashboard-page employer-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyебrow">Кабинет работодателя</p>
          <h1>{profileQuery.data?.name ?? 'Компания'}</h1>
          <p className="subtitle">{message}</p>
        </div>
        <div className="header-actions">
          <button
            className="ghost-btn"
            onClick={() => {
              authSession.clear()
              navigate('/login', { replace: true })
            }}
          >
            Выйти
          </button>
          <button className="primary-btn" onClick={() => navigate('/')}>Публичный сайт</button>
        </div>
      </header>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Вакансий</span>
          <strong>{vacancies.length}</strong>
        </article>
        <article className="stat-card">
          <span>Откликов по выбранной вакансии</span>
          <strong>{applicationsQuery.data?.length ?? 0}</strong>
        </article>
        <article className="stat-card">
          <span>Городов в каталоге</span>
          <strong>{citiesQuery.data?.length ?? 0}</strong>
        </article>
      </section>

      <main className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Профиль компании</h2>
          </div>

          <div className="form-grid">
            <label>
              Название
              <input
                value={profileForm.name}
                onChange={(e) => {
                  setProfileTouched(true)
                  setProfileForm((prev) => ({ ...prev, name: e.target.value }))
                }}
              />
            </label>
            <label>
              Сайт
              <input
                value={profileForm.website}
                onChange={(e) => {
                  setProfileTouched(true)
                  setProfileForm((prev) => ({ ...prev, website: e.target.value }))
                }}
              />
            </label>
            <label className="full-width">
              Описание
              <textarea
                rows={4}
                value={profileForm.description}
                onChange={(e) => {
                  setProfileTouched(true)
                  setProfileForm((prev) => ({ ...prev, description: e.target.value }))
                }}
              />
            </label>
            <label>
              Логотип (URL)
              <input
                value={profileForm.logo}
                onChange={(e) => {
                  setProfileTouched(true)
                  setProfileForm((prev) => ({ ...prev, logo: e.target.value }))
                }}
              />
            </label>
            <label>
              Год основания
              <input
                type="number"
                value={profileForm.founded_year}
                onChange={(e) => {
                  setProfileTouched(true)
                  setProfileForm((prev) => ({ ...prev, founded_year: e.target.value }))
                }}
              />
            </label>
            <label>
              Количество сотрудников
              <input
                type="number"
                value={profileForm.employee_count}
                onChange={(e) => {
                  setProfileTouched(true)
                  setProfileForm((prev) => ({ ...prev, employee_count: e.target.value }))
                }}
              />
            </label>
          </div>

          <div className="row-actions">
            <button
              className="primary-btn"
              onClick={() => updateProfileMutation.mutate()}
              disabled={updateProfileMutation.isPending || !profileForm.name.trim()}
            >
              {updateProfileMutation.isPending ? 'Сохраняем...' : 'Сохранить профиль'}
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Новая вакансия</h2>
          </div>

          <div className="form-grid">
            <label className="full-width">
              Название вакансии
              <input
                value={vacancyForm.title}
                onChange={(e) => setVacancyForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </label>
            <label className="full-width">
              Описание
              <textarea
                rows={5}
                value={vacancyForm.description}
                onChange={(e) => setVacancyForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </label>
            <label>
              Профессия
              <select
                value={vacancyForm.profession_id}
                onChange={(e) => setVacancyForm((prev) => ({ ...prev, profession_id: e.target.value }))}
              >
                <option value="">Выберите</option>
                {professionsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Город
              <select
                value={vacancyForm.city_id}
                onChange={(e) => setVacancyForm((prev) => ({ ...prev, city_id: e.target.value }))}
              >
                <option value="">Выберите</option>
                {citiesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Тип занятости
              <select
                value={vacancyForm.employment_type_id}
                onChange={(e) => setVacancyForm((prev) => ({ ...prev, employment_type_id: e.target.value }))}
              >
                <option value="">Выберите</option>
                {employmentTypesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              График
              <select
                value={vacancyForm.work_schedule_id}
                onChange={(e) => setVacancyForm((prev) => ({ ...prev, work_schedule_id: e.target.value }))}
              >
                <option value="">Выберите</option>
                {workSchedulesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Зарплата от
              <input
                type="number"
                value={vacancyForm.salary_min}
                onChange={(e) => setVacancyForm((prev) => ({ ...prev, salary_min: e.target.value }))}
              />
            </label>
            <label>
              Зарплата до
              <input
                type="number"
                value={vacancyForm.salary_max}
                onChange={(e) => setVacancyForm((prev) => ({ ...prev, salary_max: e.target.value }))}
              />
            </label>
            <label>
              Валюта
              <select
                value={vacancyForm.currency_id}
                onChange={(e) => setVacancyForm((prev) => ({ ...prev, currency_id: e.target.value }))}
              >
                <option value="">Выберите</option>
                {currenciesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Опыт
              <select
                value={vacancyForm.experience_id}
                onChange={(e) => setVacancyForm((prev) => ({ ...prev, experience_id: e.target.value }))}
              >
                <option value="">Выберите</option>
                {experiencesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>

          <div className="row-actions">
            <button
              className="primary-btn"
              onClick={() => createVacancyMutation.mutate()}
              disabled={
                createVacancyMutation.isPending ||
                !vacancyForm.title.trim() ||
                !vacancyForm.description.trim() ||
                Object.values(vacancyForm).some((value) => value === '')
              }
            >
              {createVacancyMutation.isPending ? 'Создаем...' : 'Опубликовать вакансию'}
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Мои вакансии</h2>
          </div>

          <div className="list-stack">
            {vacancies.map((vacancy) => (
              <article key={vacancy.id} className={`list-card ${selectedVacancy?.id === vacancy.id ? 'selected' : ''}`}>
                <div>
                  <strong>{vacancy.title}</strong>
                  <p>{vacancy.description}</p>
                </div>
                <div className="row-actions compact">
                  <button className="ghost-btn" onClick={() => setSelectedVacancyId(vacancy.id)}>
                    Отклики
                  </button>
                  <button
                    className="danger-btn"
                    onClick={() => deleteVacancyMutation.mutate(vacancy.id)}
                    disabled={deleteVacancyMutation.isPending}
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))}
            {vacancies.length === 0 && <p className="muted">Пока нет вакансий — создайте первую справа выше.</p>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Отклики {selectedVacancy ? `на «${selectedVacancy.title}»` : ''}</h2>
          </div>

          <div className="list-stack">
            {(applicationsQuery.data ?? []).map((item) => (
              <article key={`${item.vacancy_id}-${item.resume_id}`} className="list-card">
                <div>
                  <strong>Резюме #{item.resume_id}</strong>
                  <p>Текущий статус: {item.status}</p>
                </div>
                <div className="row-actions compact">
                  {(['pending', 'accepted', 'rejected'] as const).map((status) => (
                    <button
                      key={status}
                      className={item.status === status ? 'primary-btn' : 'ghost-btn'}
                      onClick={() =>
                        updateApplicationStatusMutation.mutate({
                          vacancyId: item.vacancy_id,
                          resumeId: item.resume_id,
                          status,
                        })
                      }
                      disabled={updateApplicationStatusMutation.isPending}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </article>
            ))}
            {selectedVacancy && (applicationsQuery.data?.length ?? 0) === 0 && (
              <p className="muted">По этой вакансии пока нет откликов.</p>
            )}
            {!selectedVacancy && <p className="muted">Выберите вакансию, чтобы увидеть отклики.</p>}
          </div>
        </section>
      </main>
    </div>
  )
}