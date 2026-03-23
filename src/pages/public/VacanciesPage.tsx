import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { http } from '../../shared/api/http'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import './vacancies.css'

type NamedEntity = {
  id: number
  name: string
}

type Skill = {
  id: number
  name: string
}

type Vacancy = {
  id: number
  title: string
  description?: string
  salary_min: number
  salary_max: number

  company_name?: string
  city_name?: string
  profession_name?: string

  company?: NamedEntity & { description?: string; logo?: string }
  city?: NamedEntity
  profession?: NamedEntity
  employment_type?: NamedEntity | string
  work_schedule?: NamedEntity | string
  experience?: NamedEntity | string
  currency?: NamedEntity | string

  skills?: Skill[] | string[]
}

const fetchVacancies = async (params: Record<string, unknown>) => {
  const { data } = await http.get('/public/vacancies', { params })
  return data
}

const fetchCities = async (): Promise<NamedEntity[]> => {
  const { data } = await http.get('/public/cities')
  return data
}

const fetchProfessions = async (): Promise<NamedEntity[]> => {
  const { data } = await http.get('/public/professions')
  return data
}

const fetchEmploymentTypes = async (): Promise<NamedEntity[]> => {
  const { data } = await http.get('/public/catalogs/employment-types')
  return data
}

const fetchExperiences = async (): Promise<NamedEntity[]> => {
  const { data } = await http.get('/public/catalogs/experiences')
  return data
}

const fetchWorkSchedules = async (): Promise<NamedEntity[]> => {
  const { data } = await http.get('/public/catalogs/work-schedules')
  return data
}

const getEntityName = (value?: NamedEntity | string | null) => {
  if (!value) return ''
  return typeof value === 'string' ? value : value.name
}

const getSkills = (skills?: Skill[] | string[]) => {
  if (!skills?.length) return []
  if (typeof skills[0] === 'string') return skills as string[]
  return (skills as Skill[]).map((s) => s.name)
}

const formatSalary = (min: number, max: number, currency?: NamedEntity | string) => {
  const currencyName = getEntityName(currency) || 'BYN'

  if (!min && !max) return 'Зарплата не указана'
  if (min && max && min !== max) {
    return `${min.toLocaleString('ru-RU')} — ${max.toLocaleString('ru-RU')} ${currencyName}`
  }
  if (min) return `от ${min.toLocaleString('ru-RU')} ${currencyName}`
  if (max) return `до ${max.toLocaleString('ru-RU')} ${currencyName}`
  return 'Зарплата не указана'
}

type CustomSelectProps = {
  label: string
  placeholder: string
  value?: number
  options: NamedEntity[]
  onChange: (value?: number) => void
}

function CustomSelect({ label, placeholder, value, options, onChange }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((item) => item.id === value)

  return (
    <div className="custom-select" ref={ref}>
      <label className="filter-label">{label}</label>

      <button
        type="button"
        className={`custom-select__trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{selected?.name || placeholder}</span>
        <span className="custom-select__arrow">▾</span>
      </button>

      {open && (
        <div className="custom-select__dropdown">
          <button
            type="button"
            className={`custom-select__option ${!value ? 'is-selected' : ''}`}
            onClick={() => {
              onChange(undefined)
              setOpen(false)
            }}
          >
            {placeholder}
          </button>

          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`custom-select__option ${value === item.id ? 'is-selected' : ''}`}
              onClick={() => {
                onChange(item.id)
                setOpen(false)
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const VacanciesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')

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
  const [workScheduleId, setWorkScheduleId] = useState<number | undefined>(
    searchParams.get('work_schedule_id') ? Number(searchParams.get('work_schedule_id')) : undefined
  )
  const [salaryFrom, setSalaryFrom] = useState<number | undefined>(
    searchParams.get('salary_from') ? Number(searchParams.get('salary_from')) : undefined
  )
  const [salaryTo, setSalaryTo] = useState<number | undefined>(
    searchParams.get('salary_to') ? Number(searchParams.get('salary_to')) : undefined
  )

  const citiesQuery = useQuery({ queryKey: ['cities'], queryFn: fetchCities })
  const professionsQuery = useQuery({ queryKey: ['professions'], queryFn: fetchProfessions })
  const employmentTypesQuery = useQuery({ queryKey: ['employment-types'], queryFn: fetchEmploymentTypes })
  const experiencesQuery = useQuery({ queryKey: ['experiences'], queryFn: fetchExperiences })
  const workSchedulesQuery = useQuery({ queryKey: ['work-schedules'], queryFn: fetchWorkSchedules })

  const vacanciesQuery = useQuery({
    queryKey: [
      'vacancies',
      search,
      cityId,
      professionId,
      employmentTypeId,
      experienceId,
      workScheduleId,
      salaryFrom,
      salaryTo,
    ],
    queryFn: () =>
      fetchVacancies({
        search: search || undefined,
        city_id: cityId,
        profession_id: professionId,
        employment_type_id: employmentTypeId,
        experience_id: experienceId,
        work_schedule_id: workScheduleId,
        salary_from: salaryFrom,
        salary_to: salaryTo,
        skip: 0,
        limit: 24,
      }),
  })

  useEffect(() => {
    const params: Record<string, string> = {}

    if (search) params.search = search
    if (cityId) params.city_id = String(cityId)
    if (professionId) params.profession_id = String(professionId)
    if (employmentTypeId) params.employment_type_id = String(employmentTypeId)
    if (experienceId) params.experience_id = String(experienceId)
    if (workScheduleId) params.work_schedule_id = String(workScheduleId)
    if (salaryFrom) params.salary_from = String(salaryFrom)
    if (salaryTo) params.salary_to = String(salaryTo)

    setSearchParams(params)
  }, [
    search,
    cityId,
    professionId,
    employmentTypeId,
    experienceId,
    workScheduleId,
    salaryFrom,
    salaryTo,
    setSearchParams,
  ])

  const activeFiltersCount = useMemo(() => {
    return [
      search,
      cityId,
      professionId,
      employmentTypeId,
      experienceId,
      workScheduleId,
      salaryFrom,
      salaryTo,
    ].filter(Boolean).length
  }, [search, cityId, professionId, employmentTypeId, experienceId, workScheduleId, salaryFrom, salaryTo])

  const handleSearchSubmit = (e: React.FormEvent) => {
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
    setWorkScheduleId(undefined)
    setSalaryFrom(undefined)
    setSalaryTo(undefined)
  }

  const openVacancy = (id: number) => {
    window.open(`/vacancies/${id}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="vacancies-page">
      <Header />

      <main className="vacancies-page__main">
        <section className="vacancies-hero">
          <div className="container">
            <div className="vacancies-hero__content">
              <h1 className="vacancies-hero__title">Вакансии, оформленные в стиле главной страницы</h1>
              <p className="vacancies-hero__text">
                Удобный каталог вакансий с фильтрами по городу, профессии, типу занятости,
                графику работы, опыту и зарплате.
              </p>

              <form className="vacancies-hero__search" onSubmit={handleSearchSubmit}>
                <input
                  className="vacancies-hero__input"
                  type="text"
                  placeholder="Должность, компания, навык"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button className="btn btn--primary btn--large" type="submit">
                  Найти вакансии
                </button>
              </form>

              <div className="vacancies-hero__stats">
                <div className="vacancies-stat">
                  <span className="vacancies-stat__value">
                    {vacanciesQuery.data?.length ?? '24+'}
                  </span>
                  <span className="vacancies-stat__label">вакансий</span>
                </div>
                <div className="vacancies-stat">
                  <span className="vacancies-stat__value">
                    {citiesQuery.data?.length ?? '100+'}
                  </span>
                  <span className="vacancies-stat__label">городов</span>
                </div>
                <div className="vacancies-stat">
                  <span className="vacancies-stat__value">
                    {professionsQuery.data?.length ?? '80+'}
                  </span>
                  <span className="vacancies-stat__label">профессий</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="vacancies-catalog">
          <div className="container">
            <div className="section-header vacancies-section-header">
              <div>
                <h2 className="section-title">Каталог вакансий</h2>
              </div>

              <div className="vacancies-result-badge">
                Найдено: <strong>{vacanciesQuery.data?.length ?? 0}</strong>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="active-filters">
                <span className="active-filters__label">Фильтры:</span>
                {search && <span className="active-filter-chip">Поиск: {search}</span>}
                {cityId && (
                  <span className="active-filter-chip">
                    {citiesQuery.data?.find((x) => x.id === cityId)?.name}
                  </span>
                )}
                {professionId && (
                  <span className="active-filter-chip">
                    {professionsQuery.data?.find((x) => x.id === professionId)?.name}
                  </span>
                )}
                {employmentTypeId && (
                  <span className="active-filter-chip">
                    {employmentTypesQuery.data?.find((x) => x.id === employmentTypeId)?.name}
                  </span>
                )}
                {experienceId && (
                  <span className="active-filter-chip">
                    {experiencesQuery.data?.find((x) => x.id === experienceId)?.name}
                  </span>
                )}
                {workScheduleId && (
                  <span className="active-filter-chip">
                    {workSchedulesQuery.data?.find((x) => x.id === workScheduleId)?.name}
                  </span>
                )}
              </div>
            )}

            <div className="vacancies-layout">
              <aside className="vacancies-sidebar">
                <div className="filters-card">
                  <div className="filters-card__header">
                    <div>
                      <h3>Фильтры</h3>
                      <p>Настрой подбор под свои условия</p>
                    </div>

                    <button type="button" className="btn btn--text" onClick={resetFilters}>
                      Сбросить
                    </button>
                  </div>

                  <CustomSelect
                    label="Город"
                    placeholder="Все города"
                    value={cityId}
                    options={citiesQuery.data || []}
                    onChange={setCityId}
                  />

                  <CustomSelect
                    label="Профессия"
                    placeholder="Все профессии"
                    value={professionId}
                    options={professionsQuery.data || []}
                    onChange={setProfessionId}
                  />

                  <CustomSelect
                    label="Тип занятости"
                    placeholder="Любой тип"
                    value={employmentTypeId}
                    options={employmentTypesQuery.data || []}
                    onChange={setEmploymentTypeId}
                  />

                  <CustomSelect
                    label="Опыт"
                    placeholder="Любой опыт"
                    value={experienceId}
                    options={experiencesQuery.data || []}
                    onChange={setExperienceId}
                  />

                  <CustomSelect
                    label="График работы"
                    placeholder="Любой график"
                    value={workScheduleId}
                    options={workSchedulesQuery.data || []}
                    onChange={setWorkScheduleId}
                  />

                  <div className="filter-group">
                    <label className="filter-label">Зарплата</label>
                    <div className="salary-range">
                      <input
                        type="number"
                        className="filter-control"
                        placeholder="от"
                        value={salaryFrom ?? ''}
                        onChange={(e) =>
                          setSalaryFrom(e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                      <input
                        type="number"
                        className="filter-control"
                        placeholder="до"
                        value={salaryTo ?? ''}
                        onChange={(e) =>
                          setSalaryTo(e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                    </div>
                  </div>
                </div>
              </aside>

              <div className="vacancies-content">
                {vacanciesQuery.isLoading && (
                  <div className="vacancies-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="vacancy-card vacancy-card--skeleton" />
                    ))}
                  </div>
                )}

                {vacanciesQuery.isSuccess && vacanciesQuery.data?.length === 0 && (
                  <div className="vacancies-empty">
                    <h3>Ничего не найдено</h3>
                    <p>Попробуй изменить фильтры или сбросить параметры поиска.</p>
                    <button type="button" className="btn btn--outline" onClick={resetFilters}>
                      Сбросить фильтры
                    </button>
                  </div>
                )}

                {vacanciesQuery.isSuccess && vacanciesQuery.data?.length > 0 && (
                  <div className="vacancies-grid">
                    {vacanciesQuery.data.map((vacancy: Vacancy) => {
                      const city = vacancy.city?.name || vacancy.city_name
                      const profession = vacancy.profession?.name || vacancy.profession_name
                      const company = vacancy.company?.name || vacancy.company_name
                      const employmentType = getEntityName(vacancy.employment_type)
                      const workSchedule = getEntityName(vacancy.work_schedule)
                      const experience = getEntityName(vacancy.experience)
                      const currency = vacancy.currency
                      const skills = getSkills(vacancy.skills)

                      return (
                        <article
                          key={vacancy.id}
                          className="vacancy-card"
                          onClick={() => openVacancy(vacancy.id)}
                          
                        >
                          <div className="vacancy-card__top">
                            <div className="vacancy-card__main">
                              <h3 className="vacancy-card__title">{vacancy.title}</h3>
                              <div className="vacancy-card__company">{company || 'Компания не указана'}</div>
                            </div>

                            <div className="vacancy-card__salary">
                              {formatSalary(vacancy.salary_min, vacancy.salary_max, currency)}
                            </div>
                          </div>

                          <div className="vacancy-card__meta">
                            {city && <span className="vacancy-pill">{city}</span>}
                            {profession && <span className="vacancy-pill">{profession}</span>}
                            {employmentType && <span className="vacancy-pill">{employmentType}</span>}
                            {workSchedule && <span className="vacancy-pill">{workSchedule}</span>}
                            {experience && <span className="vacancy-pill">{experience}</span>}
                          </div>

                          {vacancy.description && (
                            <p className="vacancy-card__description">
                              {vacancy.description.length > 150
                                ? `${vacancy.description.slice(0, 150)}...`
                                : vacancy.description}
                            </p>
                          )}

                          {skills.length > 0 && (
                            <div className="vacancy-card__skills">
                              {skills.slice(0, 6).map((skill) => (
                                <span className="skill-tag" key={skill}>
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="vacancy-card__bottom">
                            <span className="vacancy-card__link">Подробнее о вакансии</span>
                            <button
                              type="button"
                              className="btn btn--primary"
                              onClick={(e) => {
                                e.stopPropagation()
                                openVacancy(vacancy.id)
                              }}
                            >
                              Открыть
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}