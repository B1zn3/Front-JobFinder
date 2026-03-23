import { useEffect, useMemo, useState } from 'react'
import './applicant-cabinet.css'

export type SkillItem = {
  id: number
  name: string
}

export type ProfessionItem = {
  id: number
  name: string
}

export type WorkExperienceItem = {
  id: number
  company_name: string
  position: string
  start_date?: string | null
  end_date?: string | null
  description?: string | null
}

export type ResumeItem = {
  id: number
  profession_id: number
  profession?: ProfessionItem | null
  skills?: SkillItem[]
  work_experiences?: WorkExperienceItem[]
}

export type EducationItem = {
  id: number
  institution_id?: number | null
  institution_name?: string | null
  start_date?: string | null
  end_date?: string | null
}

export type ApplicantProfile = {
  id: number
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  phone?: string | null
  birth_date?: string | null
  gender?: string | null
  photo?: string | null
  city?: { id: number; name: string } | null
  educations?: EducationItem[]
  resumes?: ResumeItem[]
}

export type CatalogItem = {
  id: number
  name: string
}

type ProfileFormState = {
  first_name: string
  last_name: string
  middle_name: string
  phone: string
  birth_date: string
  gender: string
  city_name: string
}

type EducationFormState = {
  id?: number
  institution_id: string
  institution_name: string
  start_date: string
  end_date: string
  is_studying_now: boolean
}

type ApplicantCabinetProps = {
  profile: ApplicantProfile | undefined
  applicationsCount: number
  cities: CatalogItem[]
  institutions: CatalogItem[]
  profileSaving?: boolean
  educationSaving?: boolean
  educationDeleting?: boolean
  onOpenVacancies: () => void
  onCreateResume: () => void
  onSaveProfile: (payload: {
    first_name: string | null
    last_name: string | null
    middle_name: string | null
    phone: string | null
    birth_date: string | null
    gender: string | null
    city_name: string | null
  }) => Promise<void> | void
  onSaveEducation: (payload: {
    id?: number
    institution_id: number
    start_date: string
    end_date: string | null
  }) => Promise<void> | void
  onDeleteEducation: (educationId: number) => Promise<void> | void
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Дата не указана'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ru-RU')
}

const formatPeriod = (start?: string | null, end?: string | null) => {
  const startText = start ? formatDate(start) : 'Дата не указана'
  const endText = end ? formatDate(end) : 'По настоящее время'
  return `${startText} — ${endText}`
}

const getFullName = (profile?: ApplicantProfile) => {
  if (!profile) return 'Пользователь'
  return [profile.first_name, profile.last_name, profile.middle_name].filter(Boolean).join(' ') || 'Пользователь'
}

const createProfileForm = (profile?: ApplicantProfile): ProfileFormState => ({
  first_name: profile?.first_name ?? '',
  last_name: profile?.last_name ?? '',
  middle_name: profile?.middle_name ?? '',
  phone: profile?.phone ?? '',
  birth_date: profile?.birth_date ?? '',
  gender: profile?.gender ?? '',
  city_name: profile?.city?.name ?? '',
})

const createEducationForm = (education?: EducationItem): EducationFormState => ({
  id: education?.id,
  institution_id: education?.institution_id ? String(education.institution_id) : '',
  institution_name: education?.institution_name ?? '',
  start_date: education?.start_date ?? '',
  end_date: education?.end_date ?? '',
  is_studying_now: !education?.end_date,
})

const InlineCatalogSelect = ({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string, label: string) => void
  options: CatalogItem[]
  placeholder: string
}) => {
  return (
    <select
      className="cabinet-input"
      value={value}
      onChange={(e) => {
        const selected = options.find((item) => String(item.id) === e.target.value)
        onChange(e.target.value, selected?.name ?? '')
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  )
}

export const ApplicantCabinet = ({
  profile,
  applicationsCount,
  cities,
  institutions,
  profileSaving = false,
  educationSaving = false,
  educationDeleting = false,
  onOpenVacancies,
  onCreateResume,
  onSaveProfile,
  onSaveEducation,
  onDeleteEducation,
}: ApplicantCabinetProps) => {
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileFormState>(createProfileForm(profile))

  const [editingEducationId, setEditingEducationId] = useState<number | 'new' | null>(null)
  const [educationForm, setEducationForm] = useState<EducationFormState>(createEducationForm())

  useEffect(() => {
    setProfileForm(createProfileForm(profile))
  }, [profile])

  const resumes = profile?.resumes ?? []
  const educations = profile?.educations ?? []
  const primaryResume = resumes[0]

  const skillsText = useMemo(() => {
    const skills = primaryResume?.skills ?? []
    if (!skills.length) return 'Навыки не добавлены'
    return skills.map((item) => item.name).join(', ')
  }, [primaryResume])

  const cityText = profile?.city?.name || 'Город не указан'
  const liveText = `${cityText} • Место не указано`
  const searchPlaceText = `${cityText}, Все районы`

  const totalExperienceCount = useMemo(() => {
    return resumes.reduce((acc, resume) => acc + (resume.work_experiences?.length ?? 0), 0)
  }, [resumes])

  const startAddEducation = () => {
    setEditingEducationId('new')
    setEducationForm(createEducationForm())
  }

  const startEditEducation = (education: EducationItem) => {
    setEditingEducationId(education.id)
    setEducationForm(createEducationForm(education))
  }

  const cancelEducationEdit = () => {
    setEditingEducationId(null)
    setEducationForm(createEducationForm())
  }

  const submitProfile = async () => {
    await onSaveProfile({
      first_name: profileForm.first_name.trim() || null,
      last_name: profileForm.last_name.trim() || null,
      middle_name: profileForm.middle_name.trim() || null,
      phone: profileForm.phone.trim() || null,
      birth_date: profileForm.birth_date || null,
      gender: profileForm.gender || null,
      city_name: profileForm.city_name.trim() || null,
    })
    setEditingProfile(false)
  }

  const submitEducation = async () => {
    if (!educationForm.institution_id || !educationForm.start_date) return

    await onSaveEducation({
      id: educationForm.id,
      institution_id: Number(educationForm.institution_id),
      start_date: educationForm.start_date,
      end_date: educationForm.is_studying_now ? null : educationForm.end_date || null,
    })

    setEditingEducationId(null)
    setEducationForm(createEducationForm())
  }

  return (
    <main className="applicant-cabinet-page">
      <div className="cabinet-breadcrumbs">Мои резюме / Профиль</div>

      <section className="cabinet-hero">
        <div className="cabinet-hero__content">
          <div>
            {editingProfile ? (
              <div className="cabinet-form-grid">
                <label>
                  <span className="cabinet-field-label">Фамилия</span>
                  <input
                    className="cabinet-input"
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, last_name: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="cabinet-field-label">Имя</span>
                  <input
                    className="cabinet-input"
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, first_name: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="cabinet-field-label">Отчество</span>
                  <input
                    className="cabinet-input"
                    value={profileForm.middle_name}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, middle_name: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="cabinet-field-label">Телефон</span>
                  <input
                    className="cabinet-input"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="cabinet-field-label">Дата рождения</span>
                  <input
                    className="cabinet-input"
                    type="date"
                    value={profileForm.birth_date}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, birth_date: e.target.value }))}
                  />
                </label>

                <label>
                  <span className="cabinet-field-label">Пол</span>
                  <select
                    className="cabinet-input"
                    value={profileForm.gender}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, gender: e.target.value }))}
                  >
                    <option value="">Не указан</option>
                    <option value="м">Мужской</option>
                    <option value="ж">Женский</option>
                  </select>
                </label>

                <label className="cabinet-form-grid__full">
                  <span className="cabinet-field-label">Город</span>
                  <input
                    className="cabinet-input"
                    list="cabinet-cities"
                    value={profileForm.city_name}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, city_name: e.target.value }))}
                  />
                  <datalist id="cabinet-cities">
                    {cities.map((city) => (
                      <option key={city.id} value={city.name} />
                    ))}
                  </datalist>
                </label>
              </div>
            ) : (
              <>
                <h1>{getFullName(profile)}</h1>
                <p>{formatDate(profile?.birth_date)}</p>
              </>
            )}
          </div>

          <div className="cabinet-inline-actions">
            {editingProfile ? (
              <>
                <button className="cabinet-primary-btn" type="button" onClick={submitProfile} disabled={profileSaving}>
                  {profileSaving ? 'Сохраняем...' : 'Сохранить'}
                </button>
                <button
                  className="cabinet-secondary-btn"
                  type="button"
                  onClick={() => {
                    setProfileForm(createProfileForm(profile))
                    setEditingProfile(false)
                  }}
                  disabled={profileSaving}
                >
                  Отмена
                </button>
              </>
            ) : (
              <button className="cabinet-link-btn" type="button" onClick={() => setEditingProfile(true)}>
                Редактировать
              </button>
            )}
          </div>
        </div>

        <div className="cabinet-avatar">
          {profile?.photo ? <img src={profile.photo} alt="Фото профиля" /> : <div className="cabinet-avatar__placeholder" />}
        </div>
      </section>

      <section className="cabinet-section">
        <h2>Контакты</h2>

        <div className="cabinet-grid cabinet-grid--2">
          <article className="cabinet-card">
            <span className="cabinet-card__label">Телефон</span>
            <strong>{profile?.phone || 'Телефон не указан'}</strong>
          </article>

          <article className="cabinet-card">
            <span className="cabinet-card__label">Отклики</span>
            <strong>{applicationsCount}</strong>
          </article>
        </div>
      </section>

      <section className="cabinet-section">
        <h2>Обо мне</h2>

        <div className="cabinet-stack">
          <article className="cabinet-card cabinet-card--row">
            <div>
              <span className="cabinet-card__label">Где живёте</span>
              <strong>{liveText}</strong>
            </div>
            <button type="button" className="cabinet-icon-btn" onClick={() => setEditingProfile(true)}>
              ✎
            </button>
          </article>

          <article className="cabinet-card cabinet-card--row">
            <div>
              <span className="cabinet-card__label">Где ищете работу</span>
              <strong>{searchPlaceText}</strong>
            </div>
            <button type="button" className="cabinet-icon-btn" onClick={onOpenVacancies}>
              ✎
            </button>
          </article>
        </div>
      </section>

      <section className="cabinet-section">
        <div className="cabinet-grid cabinet-grid--2">
          <article className="cabinet-card">
            <span className="cabinet-card__label">Количество резюме</span>
            <strong>{resumes.length}</strong>
          </article>

          <article className="cabinet-card">
            <span className="cabinet-card__label">Опыт работы</span>
            <strong>{totalExperienceCount} записей</strong>
          </article>
        </div>
      </section>

      <section className="cabinet-section">
        <div className="cabinet-section__header">
          <h2>Образование</h2>
          <button className="cabinet-link-btn" type="button" onClick={startAddEducation}>
            + Добавить
          </button>
        </div>

        {(editingEducationId === 'new' || typeof editingEducationId === 'number') && (
          <article className="cabinet-card cabinet-edit-card">
            <div className="cabinet-form-grid">
              <label className="cabinet-form-grid__full">
                <span className="cabinet-field-label">Учебное заведение</span>
                <InlineCatalogSelect
                  value={educationForm.institution_id}
                  options={institutions}
                  placeholder="Выберите учебное заведение"
                  onChange={(value, label) =>
                    setEducationForm((prev) => ({
                      ...prev,
                      institution_id: value,
                      institution_name: label,
                    }))
                  }
                />
              </label>

              <label>
                <span className="cabinet-field-label">Дата начала</span>
                <input
                  className="cabinet-input"
                  type="date"
                  value={educationForm.start_date}
                  onChange={(e) => setEducationForm((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </label>

              <label>
                <span className="cabinet-field-label">Дата окончания</span>
                <input
                  className="cabinet-input"
                  type="date"
                  disabled={educationForm.is_studying_now}
                  value={educationForm.end_date}
                  onChange={(e) => setEducationForm((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </label>

              <label className="cabinet-checkbox-row cabinet-form-grid__full">
                <input
                  type="checkbox"
                  checked={educationForm.is_studying_now}
                  onChange={(e) =>
                    setEducationForm((prev) => ({
                      ...prev,
                      is_studying_now: e.target.checked,
                      end_date: e.target.checked ? '' : prev.end_date,
                    }))
                  }
                />
                Учусь здесь сейчас
              </label>
            </div>

            <div className="cabinet-inline-actions">
              <button className="cabinet-primary-btn" type="button" onClick={submitEducation} disabled={educationSaving}>
                {educationSaving ? 'Сохраняем...' : 'Сохранить'}
              </button>
              <button className="cabinet-secondary-btn" type="button" onClick={cancelEducationEdit} disabled={educationSaving}>
                Отмена
              </button>
            </div>
          </article>
        )}

        <div className="cabinet-stack">
          {educations.length ? (
            educations.map((education) => (
              <article key={education.id} className="cabinet-card cabinet-card--row">
                <div>
                  <strong>{education.institution_name || 'Учебное заведение'}</strong>
                  <p>{formatPeriod(education.start_date, education.end_date)}</p>
                </div>

                <div className="cabinet-item-actions">
                  <button type="button" className="cabinet-icon-btn" onClick={() => startEditEducation(education)}>
                    ✎
                  </button>
                  <button
                    type="button"
                    className="cabinet-danger-btn"
                    onClick={() => onDeleteEducation(education.id)}
                    disabled={educationDeleting}
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))
          ) : (
            <article className="cabinet-card">
              <strong>Образование пока не добавлено</strong>
            </article>
          )}
        </div>
      </section>

      <section className="cabinet-section">
        <div className="cabinet-section__header">
          <h2>Резюме</h2>
          <button className="cabinet-link-btn" type="button" onClick={onCreateResume}>
            Создать резюме
          </button>
        </div>

        <div className="cabinet-stack">
          {resumes.length ? (
            resumes.map((resume) => {
              const resumeSkills = resume.skills ?? []
              const resumeExperience = resume.work_experiences ?? []

              return (
                <article key={resume.id} className="cabinet-card">
                  <strong>{resume.profession?.name || `Резюме #${resume.id}`}</strong>
                  <p>
                    Навыки:{' '}
                    {resumeSkills.length ? resumeSkills.map((skill) => skill.name).join(', ') : 'не указаны'}
                  </p>
                  <p>Опыт: {resumeExperience.length} мест работы</p>
                </article>
              )
            })
          ) : (
            <article className="cabinet-card">
              <strong>Резюме пока нет</strong>
              <p>{skillsText}</p>
            </article>
          )}
        </div>
      </section>

      {!!primaryResume?.work_experiences?.length && (
        <section className="cabinet-section">
          <h2>Опыт работы</h2>

          <div className="cabinet-stack">
            {primaryResume.work_experiences.map((item) => (
              <article key={item.id} className="cabinet-card">
                <strong>{item.position}</strong>
                <p>{item.company_name}</p>
                <p>{formatPeriod(item.start_date, item.end_date)}</p>
                {item.description && <p>{item.description}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {!!primaryResume && (
        <section className="cabinet-section">
          <h2>Ключевые навыки</h2>

          <article className="cabinet-card">
            <strong>{skillsText}</strong>
          </article>
        </section>
      )}
    </main>
  )
}