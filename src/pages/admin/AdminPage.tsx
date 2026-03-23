import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import './admin.css'

type TabKey = 'overview' | 'catalogs' | 'users' | 'vacancies' | 'applications'

type CatalogItem = {
  id: number
  name: string
}

type UserAdmin = {
  id: number
  email: string
  role: string
  is_active: boolean
  company_id?: number | null
  applicant_id?: number | null
}

type VacancyAdmin = {
  id: number
  title: string
  description: string
  company_id: number
  city_id: number
  profession_id: number
  status_id: number
  salary_min: number
  salary_max: number
}

type ApplicationItem = {
  vacancy_id: number
  resume_id: number
  status: 'pending' | 'accepted' | 'rejected'
}

const catalogNames = [
  'cities',
  'professions',
  'skills',
  'currencies',
  'experiences',
  'statuses',
  'work-schedules',
  'employment-types',
] as const

const fetchCatalog = async (name: string): Promise<CatalogItem[]> => {
  const { data } = await http.get(`/admin/catalogs/${name}`, { params: { skip: 0, limit: 200 } })
  return data
}

const fetchUsers = async (): Promise<UserAdmin[]> => {
  const { data } = await http.get('/admin/users', { params: { skip: 0, limit: 200 } })
  return data
}

const fetchVacancies = async (): Promise<VacancyAdmin[]> => {
  const { data } = await http.get('/admin/vacancies', { params: { skip: 0, limit: 200 } })
  return data
}

const fetchApplications = async (): Promise<ApplicationItem[]> => {
  const { data } = await http.get('/admin/applications', { params: { skip: 0, limit: 200 } })
  return data
}

export const AdminPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [selectedCatalog, setSelectedCatalog] = useState<(typeof catalogNames)[number]>('cities')
  const [newCatalogName, setNewCatalogName] = useState('')
  const [message, setMessage] = useState('Контролируйте пользователей, справочники, вакансии и отклики.')

  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers })
  const vacanciesQuery = useQuery({ queryKey: ['admin-vacancies'], queryFn: fetchVacancies })
  const applicationsQuery = useQuery({ queryKey: ['admin-applications'], queryFn: fetchApplications })
  const statusesQuery = useQuery({ queryKey: ['admin-statuses'], queryFn: () => fetchCatalog('statuses') })
  const selectedCatalogQuery = useQuery({
    queryKey: ['admin-catalog', selectedCatalog],
    queryFn: () => fetchCatalog(selectedCatalog),
  })

  const stats = useMemo(
    () => ({
      users: usersQuery.data?.length ?? 0,
      activeUsers: usersQuery.data?.filter((item) => item.is_active).length ?? 0,
      vacancies: vacanciesQuery.data?.length ?? 0,
      applications: applicationsQuery.data?.length ?? 0,
    }),
    [applicationsQuery.data, usersQuery.data, vacanciesQuery.data],
  )

  const toggleUserMutation = useMutation({
    mutationFn: async (user: UserAdmin) => {
      await http.patch(`/admin/users/${user.id}/status`, { is_active: !user.is_active })
    },
    onSuccess: async () => {
      setMessage('Статус пользователя обновлен.')
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: () => {
      setMessage('Не удалось изменить статус пользователя.')
    },
  })

  const createCatalogItemMutation = useMutation({
    mutationFn: async () => {
      await http.post(`/admin/catalogs/${selectedCatalog}`, { name: newCatalogName.trim() })
    },
    onSuccess: async () => {
      setNewCatalogName('')
      setMessage('Элемент справочника создан.')
      await queryClient.invalidateQueries({ queryKey: ['admin-catalog', selectedCatalog] })
    },
    onError: () => {
      setMessage('Не удалось создать элемент справочника.')
    },
  })

  const deleteCatalogItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await http.delete(`/admin/catalogs/${selectedCatalog}/${itemId}`)
    },
    onSuccess: async () => {
      setMessage('Элемент справочника удален.')
      await queryClient.invalidateQueries({ queryKey: ['admin-catalog', selectedCatalog] })
    },
    onError: () => {
      setMessage('Не удалось удалить элемент справочника.')
    },
  })

  const updateVacancyStatusMutation = useMutation({
    mutationFn: async (params: { vacancyId: number; statusId: number }) => {
      await http.patch(`/admin/vacancies/${params.vacancyId}/status`, { status_id: params.statusId })
    },
    onSuccess: async () => {
      setMessage('Статус вакансии обновлен.')
      await queryClient.invalidateQueries({ queryKey: ['admin-vacancies'] })
    },
    onError: () => {
      setMessage('Не удалось обновить статус вакансии.')
    },
  })

  const renderOverview = () => (
    <section className="admin-section">
      <div className="stats-grid">
        <article className="stat-card">
          <span>Пользователи</span>
          <strong>{stats.users}</strong>
        </article>
        <article className="stat-card">
          <span>Активные аккаунты</span>
          <strong>{stats.activeUsers}</strong>
        </article>
        <article className="stat-card">
          <span>Вакансии</span>
          <strong>{stats.vacancies}</strong>
        </article>
        <article className="stat-card">
          <span>Отклики</span>
          <strong>{stats.applications}</strong>
        </article>
      </div>
    </section>
  )

  const renderCatalogs = () => (
    <section className="admin-section">
      <div className="panel-head">
        <h2>Справочники</h2>
        <select value={selectedCatalog} onChange={(e) => setSelectedCatalog(e.target.value as (typeof catalogNames)[number])}>
          {catalogNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <div className="catalog-create">
        <input
          placeholder="Новое значение"
          value={newCatalogName}
          onChange={(e) => setNewCatalogName(e.target.value)}
        />
        <button
          className="primary-btn"
          onClick={() => createCatalogItemMutation.mutate()}
          disabled={createCatalogItemMutation.isPending || !newCatalogName.trim()}
        >
          Добавить
        </button>
      </div>

      <div className="list-stack">
        {selectedCatalogQuery.data?.map((item) => (
          <article key={item.id} className="list-card">
            <div>
              <strong>{item.name}</strong>
              <p>ID: {item.id}</p>
            </div>
            <button
              className="danger-btn"
              onClick={() => deleteCatalogItemMutation.mutate(item.id)}
              disabled={deleteCatalogItemMutation.isPending}
            >
              Удалить
            </button>
          </article>
        ))}
      </div>
    </section>
  )

  const renderUsers = () => (
    <section className="admin-section">
      <div className="panel-head">
        <h2>Пользователи</h2>
      </div>

      <div className="list-stack">
        {usersQuery.data?.map((user) => (
          <article key={user.id} className="list-card">
            <div>
              <strong>{user.email}</strong>
              <p>
                Роль: {user.role} • Активен: {user.is_active ? 'да' : 'нет'}
              </p>
            </div>
            <button
              className={user.is_active ? 'danger-btn' : 'primary-btn'}
              onClick={() => toggleUserMutation.mutate(user)}
              disabled={toggleUserMutation.isPending}
            >
              {user.is_active ? 'Заблокировать' : 'Разблокировать'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )

  const renderVacancies = () => (
    <section className="admin-section">
      <div className="panel-head">
        <h2>Вакансии</h2>
      </div>

      <div className="list-stack">
        {vacanciesQuery.data?.map((vacancy) => (
          <article key={vacancy.id} className="list-card">
            <div>
              <strong>{vacancy.title}</strong>
              <p>{vacancy.description}</p>
              <p>
                Компания #{vacancy.company_id} • Город #{vacancy.city_id} • Профессия #{vacancy.profession_id}
              </p>
            </div>
            <select
              value={vacancy.status_id}
              onChange={(e) =>
                updateVacancyStatusMutation.mutate({
                  vacancyId: vacancy.id,
                  statusId: Number(e.target.value),
                })
              }
            >
              {statusesQuery.data?.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}
            </select>
          </article>
        ))}
      </div>
    </section>
  )

  const renderApplications = () => (
    <section className="admin-section">
      <div className="panel-head">
        <h2>Отклики</h2>
      </div>

      <div className="list-stack">
        {applicationsQuery.data?.map((item) => (
          <article key={`${item.vacancy_id}-${item.resume_id}`} className="list-card">
            <div>
              <strong>Вакансия #{item.vacancy_id}</strong>
              <p>Резюме #{item.resume_id}</p>
            </div>
            <span className={`status-pill ${item.status}`}>{item.status}</span>
          </article>
        ))}
      </div>
    </section>
  )

  const tabContent = {
    overview: renderOverview(),
    catalogs: renderCatalogs(),
    users: renderUsers(),
    vacancies: renderVacancies(),
    applications: renderApplications(),
  }

  return (
    <div className="dashboard-page admin-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Панель администратора</p>
          <h1>JobFinder Admin</h1>
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
          <button className="primary-btn" onClick={() => navigate('/')}>На витрину</button>
        </div>
      </header>

      <nav className="tab-row">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Обзор</button>
        <button className={activeTab === 'catalogs' ? 'active' : ''} onClick={() => setActiveTab('catalogs')}>Справочники</button>
        <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>Пользователи</button>
        <button className={activeTab === 'vacancies' ? 'active' : ''} onClick={() => setActiveTab('vacancies')}>Вакансии</button>
        <button className={activeTab === 'applications' ? 'active' : ''} onClick={() => setActiveTab('applications')}>Отклики</button>
      </nav>

      {tabContent[activeTab]}
    </div>
  )
}