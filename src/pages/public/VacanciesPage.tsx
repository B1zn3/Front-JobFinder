import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { http } from '../../shared/api/http'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import './vacancies.css'

type Vacancy = {
  id: number
  title: string
  salary_min: number
  salary_max: number
  company_name: string
  company_id?: number
  city_name?: string | null
  profession_name?: string | null
  employment_type?: string
  work_schedule?: string
  experience?: string
  skills?: Array<{ id: number; name: string }>
}

type City = {
  id: number
  name: string
}

type Profession = {
  id: number
  name: string
}

type EmploymentType = {
  id: number
  name: string
}

type Experience = {
  id: number
  name: string
}

type Skill = {
  id: number
  name: string
}

// API запросы
const fetchVacancies = async (params: {
  search?: string
  city_id?: number
  profession_id?: number
  employment_type_id?: number
  experience_id?: number
  salary_from?: number
  salary_to?: number
  skip?: number
  limit?: number
}) => {
  const { data } = await http.get('/public/vacancies', { params })
  return data
}

const fetchCities = async (): Promise<City[]> => {
  const { data } = await http.get('/public/cities')
  return data
}

const fetchProfessions = async (): Promise<Profession[]> => {
  const { data } = await http.get('/public/professions')
  return data
}

const fetchEmploymentTypes = async (): Promise<EmploymentType[]> => {
  const { data } = await http.get('/public/employment-types')
  return data
}

const fetchExperiences = async (): Promise<Experience[]> => {
  const { data } = await http.get('/public/experiences')
  return data
}

const fetchSkills = async (): Promise<Skill[]> => {
  const { data } = await http.get('/public/skills')
  return data
}

const formatSalary = (salaryMin: number, salaryMax: number) => {
  if (salaryMin === 0 && salaryMax === 0) return 'Зарплата не указана'
  if (salaryMin === salaryMax) return `${salaryMin.toLocaleString('ru-RU')} ₽`
  return `${salaryMin.toLocaleString('ru-RU')} — ${salaryMax.toLocaleString('ru-RU')} ₽`
}

export const VacanciesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Состояния фильтров
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [cityId, setCityId] = useState<number | undefined>(
    searchParams.get('city_id') ? Number(searchParams.get('city_id')) : undefined
  )
  const [professionId, setProfessionId] = useState<number | undefined>(
    searchParams.get('profession_id') ? Number(searchParams.get('profession_id')) : undefined
  )
  const [employmentTypeId, setEmploymentTypeId] = useState<number | undefined>(
    searchParams.get('employment_type_id') ? Number(searchParams.get('employment_type_id')) : undefined
  )
  const [experienceId, setExperienceId] = useState<number | undefined>(
    searchParams.get('experience_id') ? Number(searchParams.get('experience_id')) : undefined
  )
  const [salaryFrom, setSalaryFrom] = useState<number | undefined>(
    searchParams.get('salary_from') ? Number(searchParams.get('salary_from')) : undefined
  )
  const [salaryTo, setSalaryTo] = useState<number | undefined>(
    searchParams.get('salary_to') ? Number(searchParams.get('salary_to')) : undefined
  )
  const [search, setSearch] = useState(searchParams.get('search') || '')

  // Загрузка справочников
  const citiesQuery = useQuery({ queryKey: ['cities'], queryFn: fetchCities })
  const professionsQuery = useQuery({ queryKey: ['professions'], queryFn: fetchProfessions })
  const employmentTypesQuery = useQuery({ queryKey: ['employment-types'], queryFn: fetchEmploymentTypes })
  const experiencesQuery = useQuery({ queryKey: ['experiences'], queryFn: fetchExperiences })
  const skillsQuery = useQuery({ queryKey: ['skills'], queryFn: fetchSkills })

  // Загрузка вакансий с фильтрами
  const vacanciesQuery = useQuery({
    queryKey: ['vacancies', search, cityId, professionId, employmentTypeId, experienceId, salaryFrom, salaryTo],
    queryFn: () => fetchVacancies({
      search: search || undefined,
      city_id: cityId,
      profession_id: professionId,
      employment_type_id: employmentTypeId,
      experience_id: experienceId,
      salary_from: salaryFrom,
      salary_to: salaryTo,
      skip: 0,
      limit: 20,
    }),
  })

  // Обновление URL при изменении фильтров
  useEffect(() => {
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (cityId) params.city_id = String(cityId)
    if (professionId) params.profession_id = String(professionId)
    if (employmentTypeId) params.employment_type_id = String(employmentTypeId)
    if (experienceId) params.experience_id = String(experienceId)
    if (salaryFrom) params.salary_from = String(salaryFrom)
    if (salaryTo) params.salary_to = String(salaryTo)
    setSearchParams(params)
  }, [search, cityId, professionId, employmentTypeId, experienceId, salaryFrom, salaryTo, setSearchParams])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  const resetFilters = () => {
    setSearchInput('')
    setSearch('')
    setCityId(undefined)
    setProfessionId(undefined)
    setEmploymentTypeId(undefined)
    setExperienceId(undefined)
    setSalaryFrom(undefined)
    setSalaryTo(undefined)
  }

  return (
    <div className="vacancies-page">
      <Header />

      <main className="vacancies-page__main">
        <div className="container">
          <h1 className="vacancies-page__title">Поиск вакансий</h1>

          {/* Поисковая строка */}
          <div className="search-section">
            <form className="search-form" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Должность, профессия, компания, навык"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="btn btn--primary btn--large">
                Найти
              </button>
            </form>
          </div>

          <div className="vacancies-layout">
            {/* Фильтры */}
            <aside className="filters-panel">
              <div className="filters-header">
                <h3>Фильтры</h3>
                <button className="reset-filters" onClick={resetFilters}>
                  Сбросить все
                </button>
              </div>

              {/* Город */}
              <div className="filter-group">
                <label className="filter-label">Город</label>
                <select
                  value={cityId || ''}
                  onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : undefined)}
                  className="filter-select"
                >
                  <option value="">Все города</option>
                  {citiesQuery.data?.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>

              {/* Специализация */}
              <div className="filter-group">
                <label className="filter-label">Специализация</label>
                <select
                  value={professionId || ''}
                  onChange={(e) => setProfessionId(e.target.value ? Number(e.target.value) : undefined)}
                  className="filter-select"
                >
                  <option value="">Все специальности</option>
                  {professionsQuery.data?.map((prof) => (
                    <option key={prof.id} value={prof.id}>{prof.name}</option>
                  ))}
                </select>
              </div>

              {/* Зарплата */}
              <div className="filter-group">
                <label className="filter-label">Зарплата</label>
                <div className="salary-range">
                  <input
                    type="number"
                    placeholder="от"
                    value={salaryFrom || ''}
                    onChange={(e) => setSalaryFrom(e.target.value ? Number(e.target.value) : undefined)}
                    className="salary-input"
                  />
                  <span>—</span>
                  <input
                    type="number"
                    placeholder="до"
                    value={salaryTo || ''}
                    onChange={(e) => setSalaryTo(e.target.value ? Number(e.target.value) : undefined)}
                    className="salary-input"
                  />
                </div>
              </div>

              {/* Тип занятости */}
              <div className="filter-group">
                <label className="filter-label">Тип занятости</label>
                <select
                  value={employmentTypeId || ''}
                  onChange={(e) => setEmploymentTypeId(e.target.value ? Number(e.target.value) : undefined)}
                  className="filter-select"
                >
                  <option value="">Любой</option>
                  {employmentTypesQuery.data?.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              {/* Опыт работы */}
              <div className="filter-group">
                <label className="filter-label">Опыт работы</label>
                <select
                  value={experienceId || ''}
                  onChange={(e) => setExperienceId(e.target.value ? Number(e.target.value) : undefined)}
                  className="filter-select"
                >
                  <option value="">Не имеет значения</option>
                  {experiencesQuery.data?.map((exp) => (
                    <option key={exp.id} value={exp.id}>{exp.name}</option>
                  ))}
                </select>
              </div>
            </aside>

            {/* Список вакансий */}
            <div className="vacancies-list">
              {vacanciesQuery.isLoading && (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="vacancy-card vacancy-card--skeleton">
                      <div className="skeleton skeleton--title" />
                      <div className="skeleton skeleton--line" />
                      <div className="skeleton skeleton--line short" />
                      <div className="skeleton skeleton--line" />
                    </div>
                  ))}
                </>
              )}

              {vacanciesQuery.isError && (
                <div className="message message--error">
                  <h3>Не удалось загрузить вакансии</h3>
                  <p>Попробуйте обновить страницу</p>
                </div>
              )}

              {vacanciesQuery.isSuccess && vacanciesQuery.data.length === 0 && (
                <div className="message">
                  <h3>Ничего не найдено</h3>
                  <p>Попробуйте изменить параметры поиска</p>
                </div>
              )}

              {vacanciesQuery.isSuccess && vacanciesQuery.data.length > 0 && (
                <>
                  <div className="vacancies-count">
                    Найдено {vacanciesQuery.data.length} вакансий
                  </div>
                  {vacanciesQuery.data.map((vacancy: Vacancy) => (
                    <article key={vacancy.id} className="vacancy-card">
                      <div className="vacancy-card__header">
                        <h3 className="vacancy-card__title">{vacancy.title}</h3>
                        <div className="vacancy-card__salary">
                          {formatSalary(vacancy.salary_min, vacancy.salary_max)}
                        </div>
                      </div>
                      <div className="vacancy-card__company">{vacancy.company_name}</div>
                      <div className="vacancy-card__details">
                        {vacancy.city_name && (
                          <span className="vacancy-detail">{vacancy.city_name}</span>
                        )}
                        {vacancy.profession_name && (
                          <span className="vacancy-detail">{vacancy.profession_name}</span>
                        )}
                        {vacancy.employment_type && (
                          <span className="vacancy-detail">{vacancy.employment_type}</span>
                        )}
                        {vacancy.work_schedule && (
                          <span className="vacancy-detail">{vacancy.work_schedule}</span>
                        )}
                        {vacancy.experience && (
                          <span className="vacancy-detail">{vacancy.experience}</span>
                        )}
                      </div>
                      {vacancy.skills && vacancy.skills.length > 0 && (
                        <div className="vacancy-card__skills">
                          {vacancy.skills.map((skill) => (
                            <span key={skill.id} className="skill-tag">{skill.name}</span>
                          ))}
                        </div>
                      )}
                      <div className="vacancy-card__actions">
                        <button className="btn btn--outline btn--small">
                          Откликнуться
                        </button>
                      </div>
                    </article>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}