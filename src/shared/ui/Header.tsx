import { NavLink, useNavigate } from 'react-router-dom'
import { authSession } from '../../shared/auth/session'
import './Header.css'

const ChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const HeartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"
      stroke="currentColor" strokeWidth="2"/>
  </svg>
)

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
      stroke="currentColor" strokeWidth="2"/>
  </svg>
)
const LogoutIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path
      d="M16 17l5-5-5-5"
      stroke="#FF4D4F"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 12H9"
      stroke="#FF4D4F"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
      stroke="#FF4D4F"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
export const Header = () => {
  const isAuthenticated = !!authSession.getAccessToken()
  const role = authSession.getRole()

const handleLogout = () => {
  authSession.clear()
  window.location.href = '/'
}

  return (
    <header className="header">
      <div className="container header__inner">
        <div className="header__left">
          <NavLink to="/" className="header__logo">
            JobFinder
          </NavLink>

          {!isAuthenticated ? (
            <nav className="header__nav">
              <NavLink to="/vacancies" className="header__nav-link">
                Вакансии
              </NavLink>
              <NavLink to="/companies" className="header__nav-link">
                Компании
              </NavLink>
            </nav>
          ) : (
            <nav className="header__nav">
              {role === 'applicant' && (
                <>
                  <NavLink to="/applicant" className="header__nav-link">
                    Резюме
                  </NavLink>
                  <NavLink to="/vacancies" className="header__nav-link">
                    Вакансии
                  </NavLink>
                  <NavLink to="/companies" className="header__nav-link">
                    Компании
                  </NavLink>
                  <NavLink to="/applicant/responses" className="header__nav-link">
                    Отклики
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
                  <NavLink to="/employer/chat" className="header__nav-link">
                    Чат
                  </NavLink>
                  <NavLink to="/employer/company-profile" className="header__nav-link">
                    Профиль
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
              {role === 'applicant' && (
                <div className="header__applicant-tools">
                  <NavLink to="/applicant/chat" className="header__tool-btn">
                    <ChatIcon />
                  </NavLink>

                  <NavLink to="/applicant/favorites" className="header__tool-btn">
                    <HeartIcon />
                  </NavLink>

                  <NavLink to="/applicant/profile" className="header__profile-chip">
                    <span className="header__profile-chip-avatar">
                      <UserIcon />
                    </span>
                    <span className="header__profile-chip-text">Профиль</span>
                  </NavLink>

                  <button onClick={handleLogout} className="header__logout-link" type="button">
                    <LogoutIcon />
                  </button>
                </div>
              )}

              {role === 'company' && (
                <>
                  <span className="header__user">Работодатель</span>
                  <button onClick={handleLogout} className="btn btn--text">
                    Выйти
                  </button>
                </>
              )}

              {role === 'admin' && (
                <>
                  <span className="header__user">Админ</span>
                  <button onClick={handleLogout} className="btn btn--text">
                    Выйти
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}