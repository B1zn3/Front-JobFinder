import { NavLink, useNavigate } from 'react-router-dom'
import { authSession } from '../../shared/auth/session'
import './Header.css'

export const Header = () => {
  const navigate = useNavigate()
  const isAuthenticated = !!authSession.getAccessToken()
  const role = authSession.getRole()

  const handleLogout = () => {
    authSession.clear()
    navigate('/')
    window.location.reload() // обновляем состояние приложения
  }

  return (
    <header className="header">
      <div className="container header__inner">
        <div className="header__left">
          <NavLink to="/" className="header__logo">
            JobFinder
          </NavLink>

          {!isAuthenticated ? (
            // Для неавторизованных пользователей – общие ссылки
            <nav className="header__nav">
              <NavLink to="/vacancies" className="header__nav-link">
                Вакансии
              </NavLink>
              <NavLink to="/companies" className="header__nav-link">
                Компании
              </NavLink>
            </nav>
          ) : (
            // Для авторизованных – ссылки в зависимости от роли
            <nav className="header__nav">
              {role === 'applicant' && (
                <>
                  <NavLink to="/applicant/resume" className="header__nav-link">
                    Моё резюме
                  </NavLink>
                  <NavLink to="/applicant/favorites" className="header__nav-link">
                    Избранное
                  </NavLink>
                  <NavLink to="/applicant/messages" className="header__nav-link">
                    Сообщения
                  </NavLink>
                </>
              )}
              {role === 'company' && (
                <>
                  <NavLink to="/employer/vacancies" className="header__nav-link">
                    Мои вакансии
                  </NavLink>
                  <NavLink to="/employer/candidates" className="header__nav-link">
                    Кандидаты
                  </NavLink>
                  <NavLink to="/employer/messages" className="header__nav-link">
                    Сообщения
                  </NavLink>
                </>
              )}
              {role === 'admin' && (
                <NavLink to="/admin" className="header__nav-link">
                  Админ-панель
                </NavLink>
              )}
            </nav>
          )}
        </div>

        <div className="header__actions">
          {!isAuthenticated ? (
            <>
              <NavLink to="/login" className="btn btn--outline">
                Войти
              </NavLink>
              <NavLink to="/register" className="btn btn--primary">
                Регистрация
              </NavLink>
            </>
          ) : (
            <>
              <span className="header__user">
                {role === 'applicant' && 'Мой профиль'}
                {role === 'company' && 'Компания'}
                {role === 'admin' && 'Админ'}
              </span>
              <button onClick={handleLogout} className="btn btn--text">
                Выйти
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}