import { AxiosError } from 'axios'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { authSession, initializeSession } from '../../shared/auth/session'
import showPasswordIcon from '../../assets/показать_пароль.png'
import hidePasswordIcon from '../../assets/скрыть_пароль.png'
import './login.css'

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
      return 'Некорректный запрос. Проверь введенные данные.'
    case 401:
      return 'Неверный email, пароль или роль входа.'
    case 403:
      return 'Доступ запрещен. Проверь роль или статус аккаунта.'
    case 404:
      return 'Пользователь не найден.'
    case 409:
      return 'Конфликт данных. Попробуй снова.'
    case 422:
      return 'Проверь корректность email, пароля и роли.'
    case 429:
      return 'Слишком много попыток входа. Подожди и попробуй снова.'
    default:
      return 'Внутренняя ошибка сервера. Попробуй позже.'
  }
}

const roleRoute = (role: string | null) => {
  if (role === 'company') return '/employer'
  if (role === 'admin') return '/admin'
  return '/applicant'
}

export const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const fromPath = (location.state as { from?: string } | null)?.from
  const [role, setRole] = useState<RoleUi>('applicant')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const bootstrap = async () => {
      const hasSession = await initializeSession()
      if (!hasSession) return

      navigate(fromPath || roleRoute(authSession.getRole()), { replace: true })
    }

    void bootstrap()
  }, [fromPath, navigate])

  const roleText = {
    applicant: {
      title: 'Войдите, чтобы откликаться на вакансии, управлять резюме и отслеживать статусы.',
    },
    company: {
      title: 'Войдите, чтобы публиковать вакансии, управлять откликами и находить сотрудников.',
    },
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { data } = await http.post('/auth/login', {
        email,
        password,
        role,
      })

      authSession.setAccessToken(data.access_token)
      authSession.setRole(role)
      setSuccess('Вход выполнен успешно. Перенаправляем...')

      navigate(fromPath || roleRoute(role), { replace: true })
    } catch (err: unknown) {
      setError(toErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <section className="login-brand">
          <h1>jobfinder</h1>
          <p>{roleText[role].title}</p>
          <img
            src="https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=900&q=80"
            alt="Работа за ноутбуком"
          />
        </section>

        <section className="login-form-wrap">
          <Link to="/" className="back-link">← На главную</Link>
          <h2>Вход в аккаунт</h2>

          <div className="role-switch" role="tablist" aria-label="Роль входа">
            <button type="button" className={role === 'applicant' ? 'active' : ''} onClick={() => setRole('applicant')}>
              Я ищу работу
            </button>
            <button type="button" className={role === 'company' ? 'active' : ''} onClick={() => setRole('company')}>
              Я работодатель
            </button>
          </div>

          <form className="login-form" onSubmit={onSubmit}>
            <label>
              Email
              <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            <label className="password-field">
              Пароль
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            {error && <p className="form-error">{error}</p>}
            {success && <p className="form-success">{success}</p>}

            <button type="submit" disabled={loading}>{loading ? 'Входим...' : 'Войти'}</button>
          </form>

          <p className="hint">Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
        </section>
      </div>
    </div>
  )
}