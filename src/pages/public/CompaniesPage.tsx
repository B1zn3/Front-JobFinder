import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { http } from '../../shared/api/http'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import './companies.css'

type City = {
  id: number
  name: string
}

type CompanyListItem = {
  id: number
  name: string
  logo?: string | null
  city_names?: string[]
  vacancies_count: number
  first_letter?: string
}

const RU_LETTERS = [
  'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'Й', 'К', 'Л', 'М',
  'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ',
  'Э', 'Ю', 'Я',
]

const EN_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
]

const fetchCities = async (): Promise<City[]> => {
  const { data } = await http.get('/public/catalogs/cities')
  return data
}

const fetchCompanies = async (params: Record<string, unknown>): Promise<CompanyListItem[]> => {
  const { data } = await http.get('/public/companies', { params })
  return data
}

const getFirstLetter = (name: string) => {
  const first = name.trim().charAt(0).toUpperCase()
  if (!first) return '#'
  return first
}

const CompanyLogo = ({ src, name }: { src?: string | null; name: string }) => {
  if (src) {
    return <img src={src} alt={name} className="companies-page__company-logo-img" />
  }

  return (
    <div className="companies-page__company-logo-placeholder">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

type CityModalProps = {
  open: boolean
  cities: City[]
  selectedCityId?: number
  onClose: () => void
  onApply: (cityId?: number) => void
}

function CityModal({ open, cities, selectedCityId, onClose, onApply }: CityModalProps) {
  const [search, setSearch] = useState('')
  const [tempCityId, setTempCityId] = useState<number | undefined>(selectedCityId)

  useEffect(() => {
    if (open) {
      setTempCityId(selectedCityId)
      setSearch('')
    }
  }, [open, selectedCityId])

  if (!open) return null

  const filteredCities = cities.filter((city) =>
    city.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="city-modal__overlay" onClick={onClose}>
      <div className="city-modal" onClick={(e) => e.stopPropagation()}>
        <div className="city-modal__header">
          <h2>Где искать</h2>
          <button type="button" className="city-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="city-modal__search">
          <input
            type="text"
            placeholder="Поиск"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="city-modal__list">
          <button
            type="button"
            className={`city-modal__item ${tempCityId === undefined ? 'is-selected' : ''}`}
            onClick={() => setTempCityId(undefined)}
          >
            <span className="city-modal__radio" />
            <span>Все города</span>
          </button>

          {filteredCities.map((city) => (
            <button
              key={city.id}
              type="button"
              className={`city-modal__item ${tempCityId === city.id ? 'is-selected' : ''}`}
              onClick={() => setTempCityId(city.id)}
            >
              <span className="city-modal__radio" />
              <span>{city.name}</span>
            </button>
          ))}
        </div>

        <div className="city-modal__footer">
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Отменить
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onApply(tempCityId)
              onClose()
            }}
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  )
}

export const CompaniesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const sectionsRef = useRef<Record<string, HTMLDivElement | null>>({})

  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [selectedLetter, setSelectedLetter] = useState(searchParams.get('letter') || 'Все')
  const [cityId, setCityId] = useState<number | undefined>(
    searchParams.get('city_id') ? Number(searchParams.get('city_id')) : undefined
  )
  const [hasVacanciesOnly, setHasVacanciesOnly] = useState(
    searchParams.get('has_vacancies_only') === 'true'
  )
  const [cityModalOpen, setCityModalOpen] = useState(false)

  const citiesQuery = useQuery({
    queryKey: ['company-cities'],
    queryFn: fetchCities,
  })

  const companiesQuery = useQuery({
    queryKey: ['companies-list', search, cityId, hasVacanciesOnly],
    queryFn: () =>
      fetchCompanies({
        search: search || undefined,
        city_id: cityId,
        has_vacancies_only: hasVacanciesOnly || undefined,
        limit: 1000,
        skip: 0,
      }),
  })

  useEffect(() => {
    const params: Record<string, string> = {}

    if (search) params.search = search
    if (cityId) params.city_id = String(cityId)
    if (hasVacanciesOnly) params.has_vacancies_only = 'true'
    if (selectedLetter && selectedLetter !== 'Все') params.letter = selectedLetter

    setSearchParams(params)
  }, [search, cityId, hasVacanciesOnly, selectedLetter, setSearchParams])

  const selectedCityName = useMemo(() => {
    if (!cityId) return ''
    return citiesQuery.data?.find((city) => city.id === cityId)?.name || ''
  }, [cityId, citiesQuery.data])

  const filteredCompaniesByLetter = useMemo(() => {
    const companies = companiesQuery.data || []

    const normalized = companies.map((company) => ({
      ...company,
      first_letter: company.first_letter || getFirstLetter(company.name),
    }))

    const lettersFiltered =
      selectedLetter === 'Все'
        ? normalized
        : normalized.filter((company) => company.first_letter === selectedLetter)

    const grouped = lettersFiltered.reduce<Record<string, CompanyListItem[]>>((acc, company) => {
      const letter = company.first_letter || '#'
      if (!acc[letter]) acc[letter] = []
      acc[letter].push(company)
      return acc
    }, {})

    Object.keys(grouped).forEach((letter) => {
      grouped[letter].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    })

    return grouped
  }, [companiesQuery.data, selectedLetter])

  const availableLetters = useMemo(() => {
    const companies = companiesQuery.data || []
    const set = new Set<string>()

    companies.forEach((company) => {
      set.add(company.first_letter || getFirstLetter(company.name))
    })

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [companiesQuery.data])

  const totalCompanies = companiesQuery.data?.length ?? 0

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  const handleLetterClick = (letter: string) => {
    setSelectedLetter(letter)

    if (letter === 'Все') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    requestAnimationFrame(() => {
      const section = sectionsRef.current[letter]
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

  return (
    <div className="companies-page">
      <Header />

      <main className="companies-page__main">
        <section className="companies-page__hero">
          <div className="container">
            <div className="companies-page__hero-card">
              <div className="companies-page__hero-top">
                <form className="companies-page__search" onSubmit={handleSearchSubmit}>
                  <input
                    type="text"
                    placeholder="Поиск компании"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn--primary">
                    Найти
                  </button>
                </form>
              </div>

              <div className="companies-page__filters-row">
                <button
                  type="button"
                  className="companies-page__city-trigger"
                  onClick={() => setCityModalOpen(true)}
                >
                  + {selectedCityName || 'Город'}
                </button>

                <label className="companies-page__switch">
                  <span>Только компании с вакансиями</span>
                  <input
                    type="checkbox"
                    checked={hasVacanciesOnly}
                    onChange={(e) => setHasVacanciesOnly(e.target.checked)}
                  />
                  <span className="companies-page__switch-slider" />
                </label>
              </div>

              <div className="companies-page__alphabet">
                <button
                  type="button"
                  className={`companies-page__alphabet-link ${selectedLetter === 'Все' ? 'is-active' : ''}`}
                  onClick={() => handleLetterClick('Все')}
                >
                  Все
                </button>

                {EN_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    className={`companies-page__alphabet-link ${
                      selectedLetter === letter ? 'is-active' : ''
                    } ${availableLetters.includes(letter) ? '' : 'is-disabled'}`}
                    onClick={() => handleLetterClick(letter)}
                    disabled={!availableLetters.includes(letter)}
                  >
                    {letter}
                  </button>
                ))}

                {RU_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    className={`companies-page__alphabet-link ${
                      selectedLetter === letter ? 'is-active' : ''
                    } ${availableLetters.includes(letter) ? '' : 'is-disabled'}`}
                    onClick={() => handleLetterClick(letter)}
                    disabled={!availableLetters.includes(letter)}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="companies-page__catalog">
          <div className="container">
            <div className="companies-page__summary">
              <span>{totalCompanies.toLocaleString('ru-RU')} компаний</span>
            </div>

            {companiesQuery.isLoading && (
              <div className="companies-page__grid">
                {Array.from({ length: 12 }).map((_, index) => (
                  <div key={index} className="companies-page__card companies-page__card--skeleton" />
                ))}
              </div>
            )}

            {companiesQuery.isSuccess && totalCompanies === 0 && (
              <div className="companies-page__empty">
                <h3>Компании не найдены</h3>
                <p>Попробуйте изменить поиск или выбранный город.</p>
              </div>
            )}

            {companiesQuery.isSuccess && totalCompanies > 0 && (
              <div className="companies-page__sections">
                {Object.entries(filteredCompaniesByLetter)
                  .sort(([a], [b]) => a.localeCompare(b, 'ru'))
                  .map(([letter, companies]) => (
                    <div
                      key={letter}
                      className="companies-page__section"
                      ref={(node) => {
                        sectionsRef.current[letter] = node
                      }}
                    >
                      <h2 className="companies-page__letter">{letter}</h2>

                      <div className="companies-page__grid">
                        {companies.map((company) => (
                          <a
                            key={company.id}
                            href={`/companies/${company.id}`}
                            className="companies-page__card"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <div className="companies-page__card-head">
                              <div className="companies-page__card-logo">
                                <CompanyLogo src={company.logo} name={company.name} />
                              </div>

                              <div className="companies-page__card-main">
                                <h3>{company.name}</h3>
                                {company.city_names && company.city_names.length > 0 && (
                                  <div className="companies-page__card-cities">
                                    {company.city_names.slice(0, 3).join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="companies-page__card-footer">
                              {company.vacancies_count} {company.vacancies_count === 1 ? 'вакансия' : 'вакансий'}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />

      <CityModal
        open={cityModalOpen}
        cities={citiesQuery.data || []}
        selectedCityId={cityId}
        onClose={() => setCityModalOpen(false)}
        onApply={(value) => setCityId(value)}
      />
    </div>
  )
}