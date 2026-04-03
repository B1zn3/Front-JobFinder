import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { http } from '../../shared/api/http'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import './company-detail.css'

type CompanyDetail = {
  id: number
  name: string
  description?: string | null
  website?: string | null
  logo?: string | null
  founded_year?: number | null
  employee_count?: number | null
  vacancies_count?: number
  city_names?: string[]
  first_letter?: string
  company_type_name?: string | null
}

type VacancyListItem = {
  id: number
  title: string
  salary_min?: number | null
  salary_max?: number | null
  currency?: string | null
  city_name?: string | null
  profession_name?: string | null
  company_name?: string | null
}

const fetchCompany = async (companyId: string): Promise<CompanyDetail> => {
  const { data } = await http.get(`/public/companies/${companyId}`)
  return data
}

const fetchCompanyVacancies = async (companyId: string): Promise<VacancyListItem[]> => {
  const { data } = await http.get('/public/vacancies', {
    params: {
      company_id: companyId,
      skip: 0,
      limit: 50,
    },
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
    if (min === max) return `${min.toLocaleString('ru-RU')} ${currency}`
    return `${min.toLocaleString('ru-RU')} — ${max.toLocaleString('ru-RU')} ${currency}`
  }

  if (min) return `от ${min.toLocaleString('ru-RU')} ${currency}`
  if (max) return `до ${max.toLocaleString('ru-RU')} ${currency}`

  return 'Зарплата не указана'
}

const normalizeWebsiteUrl = (website?: string | null) => {
  if (!website) return null
  if (/^https?:\/\//i.test(website)) return website
  return `https://${website}`
}

const CompanyLogo = ({ src, name }: { src?: string | null; name: string }) => {
  if (src) {
    return <img src={src} alt={name} className="company-detail__logo-img" />
  }

  return (
    <div className="company-detail__logo-placeholder">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export const CompanyDetailPage = () => {
  const { companyId } = useParams<{ companyId: string }>()

  const companyQuery = useQuery({
    queryKey: ['company-detail', companyId],
    queryFn: () => fetchCompany(companyId as string),
    enabled: Boolean(companyId),
  })

  const vacanciesQuery = useQuery({
    queryKey: ['company-vacancies', companyId],
    queryFn: () => fetchCompanyVacancies(companyId as string),
    enabled: Boolean(companyId),
  })

  const visibleVacancies = useMemo(() => {
    return (vacanciesQuery.data || []).slice(0, 4)
  }, [vacanciesQuery.data])

  if (!companyId) {
    return <main style={{ padding: 24 }}>Некорректный id компании.</main>
  }

  if (companyQuery.isLoading) {
    return <main style={{ padding: 24 }}>Загружаем карточку компании...</main>
  }

  if (companyQuery.isError || !companyQuery.data) {
    return <main style={{ padding: 24 }}>Не удалось загрузить карточку компании.</main>
  }

  const company = companyQuery.data
  const vacancies = vacanciesQuery.data || []
  const hasMoreThanFour = vacancies.length > 4
  const websiteUrl = normalizeWebsiteUrl(company.website)

  return (
    <div className="company-detail-page">
      <Header />

      <main className="company-detail-page__main">
        <section className="company-detail-hero">
          <div className="container">
            <div className="company-detail-hero__card">
              <div className="company-detail-hero__top">
                <div className="company-detail-hero__logo">
                  <CompanyLogo src={company.logo} name={company.name} />
                </div>

                <div className="company-detail-hero__main">
                  <div className="company-detail-hero__breadcrumbs">
                    <Link to="/companies">Компании</Link>
                    <span>•</span>
                    <span>{company.name}</span>
                  </div>

                  <h1 className="company-detail-hero__title">{company.name}</h1>

                  <div className="company-detail-hero__meta">
                    {company.company_type_name ? (
                      <span className="company-detail-pill company-detail-pill--accent">
                        {company.company_type_name}
                      </span>
                    ) : null}

                    {company.city_names?.length ? (
                      <span className="company-detail-pill">
                        {company.city_names.join(', ')}
                      </span>
                    ) : null}
                  </div>

                  {websiteUrl && (
                    <a
                      className="company-detail-hero__website"
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Перейти на сайт
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="company-detail-content">
          <div className="container">
            <div className="company-detail-layout">
              <section className="company-detail-main">
                <article className="company-detail-card">
                  <div className="company-detail-card__header">
                    <h2>О компании</h2>
                  </div>

                  <div className="company-detail-card__body">
                    <p className="company-detail-description">
                      {company.description || 'Описание компании пока не указано.'}
                    </p>
                  </div>
                </article>

                <article className="company-detail-card">
                  <div className="company-detail-card__header">
                    <h2>Вакансии компании</h2>
                  </div>

                  <div className="company-detail-card__body">
                    {vacanciesQuery.isLoading && (
                      <div className="company-detail-vacancies">
                        <div className="company-detail-vacancy company-detail-vacancy--skeleton" />
                        <div className="company-detail-vacancy company-detail-vacancy--skeleton" />
                        <div className="company-detail-vacancy company-detail-vacancy--skeleton" />
                      </div>
                    )}

                    {!vacanciesQuery.isLoading && vacancies.length === 0 && (
                      <div className="company-detail-empty">
                        У этой компании пока нет активных вакансий.
                      </div>
                    )}

                    {!vacanciesQuery.isLoading && vacancies.length > 0 && (
                      <>
                        <div className="company-detail-vacancies">
                          {visibleVacancies.map((vacancy) => (
                            <a
                              key={vacancy.id}
                              href={`/vacancies/${vacancy.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="company-detail-vacancy"
                            >
                              <div className="company-detail-vacancy__top">
                                <h3>{vacancy.title}</h3>
                                <span className="company-detail-vacancy__salary">
                                  {formatSalary(
                                    vacancy.salary_min,
                                    vacancy.salary_max,
                                    vacancy.currency || 'BYN'
                                  )}
                                </span>
                              </div>

                              <div className="company-detail-vacancy__meta">
                                {vacancy.city_name && (
                                  <span className="company-detail-vacancy__pill">
                                    {vacancy.city_name}
                                  </span>
                                )}
                                {vacancy.profession_name && (
                                  <span className="company-detail-vacancy__pill">
                                    {vacancy.profession_name}
                                  </span>
                                )}
                              </div>
                            </a>
                          ))}
                        </div>

                        {hasMoreThanFour && (
                          <div className="company-detail-card__more">
                            <Link
                              to={`/vacancies?search=${encodeURIComponent(company.name)}`}
                              className="company-detail-card__more-link"
                            >
                              Смотреть все вакансии компании
                            </Link>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </article>
              </section>

              <aside className="company-detail-sidebar">
                <section className="company-detail-card company-detail-info-card">
                  <h3>Краткая информация</h3>

                  <div className="company-detail-info-list">
                    <div className="company-detail-info-row">
                      <span>Название</span>
                      <strong>{company.name}</strong>
                    </div>

                    {company.company_type_name && (
                      <div className="company-detail-info-row">
                        <span>Тип организации</span>
                        <strong>{company.company_type_name}</strong>
                      </div>
                    )}

                    {company.founded_year && (
                      <div className="company-detail-info-row">
                        <span>Год основания</span>
                        <strong>{company.founded_year}</strong>
                      </div>
                    )}

                    {company.employee_count && (
                      <div className="company-detail-info-row">
                        <span>Сотрудников</span>
                        <strong>{company.employee_count}</strong>
                      </div>
                    )}

                    <div className="company-detail-info-row">
                      <span>Активных вакансий</span>
                      <strong>{company.vacancies_count || 0}</strong>
                    </div>

                    {company.city_names?.length ? (
                      <div className="company-detail-info-row">
                        <span>Города</span>
                        <strong>{company.city_names.join(', ')}</strong>
                      </div>
                    ) : null}

                    {websiteUrl && (
                      <div className="company-detail-info-row">
                        <span>Сайт</span>
                        <a href={websiteUrl} target="_blank" rel="noreferrer">
                          Перейти
                        </a>
                      </div>
                    )}
                  </div>
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