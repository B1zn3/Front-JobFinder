import { AxiosError } from 'axios'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import showPasswordIcon from '../../assets/показать_пароль.png'
import hidePasswordIcon from '../../assets/скрыть_пароль.png'
import heroImage from '../../assets/регистрция.avif'
import './register.css'

type RoleUi = 'applicant' | 'company'

type FastApiValidationError = {
  detail?: Array<{ loc?: Array<string | number>; msg?: string; type?: string }> | string
}

const translateValidationMessage = (msg?: string): string => {
  if (!msg) return 'Некорректные данные.'
  if (msg.includes('String should have at least')) {
    const num = msg.match(/(\d+)/)?.[1]
    return num ? `Строка должна содержать минимум ${num} символов.` : 'Слишком короткое значение.'
  }
  if (msg.includes('Field required')) return 'Обязательное поле не заполнено.'
  if (msg.includes('Input should be a valid email')) return 'Укажите корректный email.'
  if (/[A-Za-z]/.test(msg)) return 'Некорректные данные.'
  return msg
}

const toErrorMessage = (error: unknown): string => {
  const axiosErr = error as AxiosError<FastApiValidationError>

  if (!axiosErr?.response) {
    return 'Сервер недоступен. Проверь бэкенд, CORS и подключение к сети.'
  }

  const status = axiosErr.response.status
  const data = axiosErr.response.data

  if (Array.isArray(data?.detail)) {
    return (
      data.detail
        .map((item) => translateValidationMessage(item.msg))
        .filter(Boolean)
        .join('; ') || 'Ошибка валидации данных.'
    )
  }

  if (typeof data?.detail === 'string') {
    return translateValidationMessage(data.detail)
  }

  switch (status) {
    case 400:
      return 'Некорректные данные для регистрации.'
    case 409:
      return 'Такой пользователь уже существует.'
    case 422:
      return 'Проверь email, пароль (мин. 8 символов) и роль.'
    default:
      return 'Внутренняя ошибка сервера. Попробуй позже.'
  }
}

export const RegisterPage = () => {
  const navigate = useNavigate()
  const [role, setRole] = useState<RoleUi>('applicant')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const roleText = {
    applicant: {
      title: 'Создайте профиль, чтобы откликаться на вакансии и управлять резюме.',
    },
    company: {
      title: 'Создайте профиль компании, чтобы публиковать вакансии и находить сотрудников.',
    },
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.')
      return
    }

    if (role === 'company' && !companyName.trim()) {
      setError('Для работодателя нужно указать название компании.')
      return
    }

    setLoading(true)
    try {
      await http.post('/auth/register', {
        email,
        password,
        role,
        company_name: role === 'company' ? companyName.trim() : null,
      })

      const { data } = await http.post('/auth/login', {
        email,
        password,
        role,
      })

      authSession.setAccessToken(data.access_token)
      authSession.setRole(role)
      setSuccess('Регистрация успешна. Выполнен автоматический вход...')
      navigate(role === 'company' ? '/employer' : '/applicant', { replace: true })
    } catch (err: unknown) {
      setError(toErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      <div className="register-card">
        <section className="register-brand">
          <h1>jobfinder</h1>
          <p>{roleText[role].title}</p>
          <img src={heroImage} alt="Команда за работой" />
        </section>

        <section className="register-form-wrap">
          <Link to="/" className="back-link">← На главную</Link>
          <h2>Регистрация</h2>

          <div className="role-switch" role="tablist" aria-label="Роль регистрации">
            <button
              type="button"
              className={role === 'applicant' ? 'active' : ''}
              onClick={() => setRole('applicant')}
            >
              Я ищу работу
            </button>
            <button
              type="button"
              className={role === 'company' ? 'active' : ''}
              onClick={() => setRole('company')}
            >
              Я ищу работников
            </button>
          </div>

          <form className="register-form" onSubmit={onSubmit}>
            <div className="fields-container">
              <label>
                Email
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              {role === 'company' && (
                <label>
                  Название компании
                  <input
                    type="text"
                    placeholder="ООО Ромашка"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </label>
              )}

              <label className="password-field">
                Пароль
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="не меньше 8 символов"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <img
                      src={showPassword ? hidePasswordIcon : showPasswordIcon}
                      alt={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    />
                  </button>
                </div>
              </label>

              <label className="password-field">
                Подтвердите пароль
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <img
                      src={showConfirmPassword ? hidePasswordIcon : showPasswordIcon}
                      alt={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    />
                  </button>
                </div>
              </label>
            </div>

            <div className="submit-area">
              {error && <p className="form-error">{error}</p>}
              {success && <p className="form-success">{success}</p>}
              <button type="submit" disabled={loading}>
                {loading ? 'Создаем...' : 'Зарегистрироваться'}
              </button>
            </div>
          </form>

          <p className="hint">
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </p>
        </section>
      </div>
    </div>
  )
}