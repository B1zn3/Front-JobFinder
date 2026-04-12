import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import './vacancy-detail.css'

type VacancyListItem = {
  id: number
  title: string
  salary_min?: number | null
  salary_max?: number | null
  company_name: string
  currency?: string | null
}

type VacancyDetail = {
  id: number
  title: string
  description: string
  salary_min?: number | null
  salary_max?: number | null
  company_name: string
  city_name: string
  profession_name: string
  employment_type: string
  work_schedule: string
  currency?: string | null
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

const formatSalary = (
  salaryMin?: number | null,
  salaryMax?: number | null,
  currency = 'BYN'
) => {
  const min = typeof salaryMin === 'number' && salaryMin > 0 ? salaryMin : null
  const max = typeof salaryMax === 'number' && salaryMax > 0 ? salaryMax : null

  if (min && max) {
    if (min === max) {
      return `${min.toLocaleString('ru-RU')} ${currency}`
    }
    return `${min.toLocaleString('ru-RU')} — ${max.toLocaleString('ru-RU')} ${currency}`
  }

  if (min) {
    return `от ${min.toLocaleString('ru-RU')} ${currency}`
  }

  if (max) {
    return `до ${max.toLocaleString('ru-RU')} ${currency}`
  }

  return 'Зарплата не указана'
}

export const VacancyDetailPage = () => {
  const navigate = useNavigate()
  const { vacancyId } = useParams<{ vacancyId: string }>()

  const isAuthenticated = Boolean(
    localStorage.getItem('access_token') || localStorage.getItem('token')
  )

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
    return relatedQuery.data.filter((item) => item.id !== Number(vacancyId)).slice(0, 3)
  }, [relatedQuery.data, vacancyId])

  const handleApply = () => {
    if (!vacancyId) return

    if (!isAuthenticated) {
      navigate(`/register?redirect=${encodeURIComponent(`/vacancies/${vacancyId}`)}`)
      return
    }

    navigate(`/vacancies/${vacancyId}/apply`)
  }

  if (!vacancyId) {
    return <main style={{ padding: 24 }}>Некорректный id вакансии.</main>
  }

  if (vacancyQuery.isLoading) {
    return <main style={{ padding: 24 }}>Загружаем карточку вакансии...</main>
  }

  if (vacancyQuery.isError || !vacancyQuery.data) {
    return <main style={{ padding: 24 }}>Не удалось загрузить карточку вакансии.</main>
  }

  const vacancy = vacancyQuery.data
  const vacancyCurrency = vacancy.currency || 'BYN'

  return (
    <div className="vacancy-detail-page">
      <Header />

      <main className="vacancy-detail-page__main">
        <section className="vacancy-detail-hero">
          <div className="container">
            <div className="vacancy-detail-hero__card">
              <div className="vacancy-detail-hero__breadcrumbs">
                <Link to="/vacancies">Вакансии</Link>
                <span>•</span>
                <span>{vacancy.profession_name}</span>
              </div>

              <div className="vacancy-detail-hero__top">
                <div className="vacancy-detail-hero__main">
                  <h1 className="vacancy-detail-hero__title">{vacancy.title}</h1>
                  <div className="vacancy-detail-hero__company">{vacancy.company_name}</div>
                  <div className="vacancy-detail-hero__location">{vacancy.city_name}</div>
                </div>

                <div className="vacancy-detail-hero__salary-box">
                  <strong className="vacancy-detail-hero__salary-value">
                    {formatSalary(vacancy.salary_min, vacancy.salary_max, vacancyCurrency)}
                  </strong>
                </div>
              </div>

              <div className="vacancy-detail-hero__meta">
                <span className="vacancy-detail-pill">{vacancy.profession_name}</span>
                <span className="vacancy-detail-pill">{vacancy.employment_type}</span>
                <span className="vacancy-detail-pill">{vacancy.work_schedule}</span>
                <span className="vacancy-detail-pill">{vacancy.experience}</span>
              </div>

              <div className="vacancy-detail-hero__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--large vacancy-detail-apply-btn"
                  onClick={handleApply}
                >
                  Откликнуться
                </button>

              </div>
            </div>
          </div>
        </section>

        <section className="vacancy-detail-content">
          <div className="container">
            <div className="vacancy-detail-layout">
              <section className="vacancy-detail-main">
                <article className="vacancy-detail-card">
                  <div className="vacancy-detail-card__header">
                    <h2>Описание вакансии</h2>
                  </div>

                  <div className="vacancy-detail-card__body">
                    <p className="vacancy-detail-description">{vacancy.description}</p>
                  </div>
                </article>

                <article className="vacancy-detail-card">
                  <div className="vacancy-detail-card__header">
                    <h2>Ключевые навыки</h2>
                  </div>

                  <div className="vacancy-detail-card__body">
                    <div className="vacancy-detail-skills">
                      {vacancy.skills.length === 0 && (
                        <span className="vacancy-detail-skill">Не указаны</span>
                      )}

                      {vacancy.skills.map((skill) => (
                        <span key={skill} className="vacancy-detail-skill">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>

                {relatedVacancies.length > 0 && (
                  <article className="vacancy-detail-card">
                    <div className="vacancy-detail-card__header">
                      <h2>Похожие вакансии</h2>
                    </div>

                    <div className="vacancy-related-list">
                      {relatedVacancies.map((item) => (
                        <a
                          key={item.id}
                          href={`/vacancies/${item.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="vacancy-related-item"
                        >
                          <div className="vacancy-related-item__title">{item.title}</div>
                          <div className="vacancy-related-item__salary">
                            {formatSalary(item.salary_min, item.salary_max, item.currency || vacancyCurrency)}
                          </div>
                          <div className="vacancy-related-item__company">{item.company_name}</div>
                        </a>
                      ))}
                    </div>
                  </article>
                )}
              </section>

              <aside className="vacancy-detail-sidebar">
                <section className="vacancy-detail-card vacancy-company-card">
                  <div className="vacancy-company-card__head">
                    {vacancy.company_logo ? (
                      <img
                        src={vacancy.company_logo}
                        alt={vacancy.company_name}
                        className="vacancy-company-card__logo"
                      />
                    ) : (
                      <div className="vacancy-company-card__logo vacancy-company-card__logo--placeholder">
                        {vacancy.company_name.slice(0, 1).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <h3>{vacancy.company_name}</h3>
                      <p>Информация о компании</p>
                    </div>
                  </div>

                  {vacancy.company_description && (
                    <p className="vacancy-company-card__description">{vacancy.company_description}</p>
                  )}

                  <ul className="vacancy-company-card__list">
                    {vacancy.company_founded_year && (
                      <li>
                        <span>Год основания</span>
                        <strong>{vacancy.company_founded_year}</strong>
                      </li>
                    )}

                    {vacancy.company_employee_count && (
                      <li>
                        <span>Сотрудников</span>
                        <strong>{vacancy.company_employee_count}</strong>
                      </li>
                    )}

                    <li>
                      <span>Город</span>
                      <strong>{vacancy.city_name}</strong>
                    </li>

                    {vacancy.company_website && (
                      <li>
                        <span>Сайт</span>
                        <a href={vacancy.company_website} target="_blank" rel="noreferrer">
                          Перейти
                        </a>
                      </li>
                    )}
                  </ul>
                </section>

                
              </aside>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}