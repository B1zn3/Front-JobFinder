import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import './vacancy-detail.css'

type VacancyListItem = {
  id: number
  title: string
  salary_min: number
  salary_max: number
  company_name: string
}

type VacancyDetail = {
  id: number
  title: string
  description: string
  salary_min: number
  salary_max: number
  company_name: string
  city_name: string
  profession_name: string
  employment_type: string
  work_schedule: string
  currency: string
  experience: string
  skills: string[]
  company_description?: string | null
  company_website?: string | null
  company_logo?: string | null
  company_founded_year?: number | null
  company_employee_count?: number | null
}

const fetchVacancy = async (id: string): Promise<VacancyDetail> => {
  const { data } = await http.get(`/public/vacancies/${id}`)
  return data
}

const fetchRelatedVacancies = async (search: string): Promise<VacancyListItem[]> => {
  const { data } = await http.get('/public/vacancies', {
    params: { search, limit: 12, skip: 0 },
  })
  return data
}

const formatSalary = (salaryMin: number, salaryMax: number, currency = 'RUB') => {
  return `${salaryMin.toLocaleString('ru-RU')} — ${salaryMax.toLocaleString('ru-RU')} ${currency}`
}

export const VacancyDetailPage = () => {
  const navigate = useNavigate()
  const { vacancyId } = useParams<{ vacancyId: string }>()
  const [menuOpen, setMenuOpen] = useState(false)

  const vacancyQuery = useQuery({
    queryKey: ['vacancy-detail', vacancyId],
    queryFn: () => fetchVacancy(vacancyId as string),
    enabled: Boolean(vacancyId),
  })

  const relatedQuery = useQuery({
    queryKey: ['vacancy-related', vacancyQuery.data?.title],
    enabled: Boolean(vacancyQuery.data?.title),
    queryFn: () => fetchRelatedVacancies(vacancyQuery.data?.title.split(' ')[0] ?? ''),
  })

  const relatedVacancies = useMemo(() => {
    if (!relatedQuery.data) return []
    return relatedQuery.data.filter((item) => item.id !== Number(vacancyId)).slice(0, 2)
  }, [relatedQuery.data, vacancyId])

  if (!vacancyId) return <main style={{ padding: 24 }}>Некорректный id вакансии.</main>
  if (vacancyQuery.isLoading) return <main style={{ padding: 24 }}>Загружаем карточку вакансии...</main>
  if (vacancyQuery.isError || !vacancyQuery.data) return <main style={{ padding: 24 }}>Не удалось загрузить карточку вакансии.</main>

  const vacancy = vacancyQuery.data

  return (
    <div className="vacancy-detail-page">
      <header className="hh-topbar full-header">
        <div className="left-nav">
          <Link to="/applicant" className="top-link">Резюме и профиль</Link>
          <Link to="/applicant" className="top-link">Вакансии</Link>
          <Link to="/applicant" className="top-link">Отклики</Link>
          <Link to="/applicant" className="top-link">Помощь</Link>
        </div>

        <div className="right-nav">
          <button className="icon-btn" onClick={() => navigate('/applicant')}>🔎 Поиск</button>
          <button className="icon-btn">💬</button>
          <button className="icon-btn">♡</button>
          <button className="create-btn">Создать резюме</button>
          <div className="burger-wrap">
            <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)}>☰</button>
            {menuOpen && (
              <div className="burger-menu">
                <button onClick={() => navigate('/applicant')}>Перейти в профиль</button>
                <button
                  onClick={() => {
                    authSession.clear()
                    navigate('/login', { replace: true })
                  }}
                >
                  Выйти из аккаунта
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="vacancy-detail-layout">
        <section className="vacancy-main-card">
          <h1>{vacancy.title}</h1>
          <p className="salary">{formatSalary(vacancy.salary_min, vacancy.salary_max, vacancy.currency)}</p>
          <p>Опыт работы: {vacancy.experience}</p>
          <p>
            {vacancy.employment_type} • {vacancy.work_schedule}
          </p>
          <p>Регион: {vacancy.city_name}</p>
          <p>Специализация: {vacancy.profession_name}</p>

          <div className="vacancy-actions">
            <button>Откликнуться</button>
            <button className="ghost">♡</button>
            <button className="ghost">⋯</button>
          </div>

          <article className="description-block">
            <h2>Описание вакансии</h2>
            <p>{vacancy.description}</p>
          </article>

          <article className="description-block">
            <h2>Ключевые навыки</h2>
            <div className="skills-row">
              {vacancy.skills.length === 0 && <span className="skill-chip">Не указаны</span>}
              {vacancy.skills.map((skill) => (
                <span key={skill} className="skill-chip">{skill}</span>
              ))}
            </div>
          </article>
        </section>

        <aside className="vacancy-side-col">
          <section className="company-card">
            {vacancy.company_logo && <img src={vacancy.company_logo} alt={vacancy.company_name} />}
            <h3>{vacancy.company_name}</h3>
            {vacancy.company_description && <p>{vacancy.company_description}</p>}
            <ul>
              {vacancy.company_founded_year && <li>Год основания: {vacancy.company_founded_year}</li>}
              {vacancy.company_employee_count && <li>Сотрудников: {vacancy.company_employee_count}</li>}
              {vacancy.company_website && (
                <li>
                  Сайт: <a href={vacancy.company_website} target="_blank" rel="noreferrer">{vacancy.company_website}</a>
                </li>
              )}
            </ul>
          </section>

          <section className="related-card">
            <h4>Вам могут подойти эти вакансии</h4>
            <div className="related-list">
              {relatedVacancies.map((item) => (
                <a key={item.id} href={`/vacancies/${item.id}`} target="_blank" rel="noreferrer" className="related-item">
                  <strong>{item.title}</strong>
                  <span>{formatSalary(item.salary_min, item.salary_max)}</span>
                  <em>{item.company_name}</em>
                </a>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  )
}