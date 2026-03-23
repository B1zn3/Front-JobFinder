import React from 'react'
import { Link } from 'react-router-dom'
import './Footer.css'

export const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__main">
          <div className="footer__brand">
            <Link to="/" className="footer__logo">JobFinder</Link>
            <p className="footer__tagline">Найди работу мечты</p>
          </div>

          <div className="footer__links">
            {/* Первая колонка — контакты */}
            <div className="footer__links-column">
              <h4>Контакты</h4>
              <a href="mailto:support@jobfinder.by">support@jobfinder.by</a>
              <a href="mailto:partners@jobfinder.by">partners@jobfinder.by</a>
              <a href="tel:+375171234567">+375 (17) 123-45-67</a>
              <p style={{ marginTop: '0.5rem', color: '#999', fontSize: '0.9rem' }}>
                Пн–Пт, 9:00–18:00
              </p>
            </div>

            {/* Вторая колонка — социальные сети (внешние ссылки) */}
            <div className="footer__links-column">
              <h4>Мы в соцсетях</h4>
              <a href="https://t.me/jobfinder" target="_blank" rel="noopener noreferrer">
                Telegram
              </a>
              <a href="https://instagram.com/jobfinder.by" target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
              <a href="https://linkedin.com/company/jobfinder" target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </div>

            {/* Третья колонка — полезные ссылки (якоря на главной) */}
           <div className="footer__links-column">
  <h4>О JobFinder</h4>
  <p style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: 1.5 }}>
    Помогаем соискателям находить работу, а компаниям — сотрудников с 2020 года. Более 5000 успешных размещений.
  </p>
</div>
          </div>
        </div>

        <div className="footer__bottom">
          <div className="footer__copyright">
            © {new Date().getFullYear()} JobFinder. Все права защищены.
          </div>
          <button onClick={scrollToTop} className="footer__back-to-top">
            Наверх ↑
          </button>
        </div>
      </div>
    </footer>
  )
}