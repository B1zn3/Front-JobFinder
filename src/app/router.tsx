import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'
import { HomePage } from '../pages/home/HomePage'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { VacancyDetailPage } from '../pages/vacancy/VacancyDetailPage'
import { ApplicantPage } from '../pages/applicant/ApplicantPage '
import { EmployerPage } from '../pages/employer/EmployerPage'
import { AdminPage } from '../pages/admin/AdminPage'
import { RequireAuth } from '../shared/auth/RequireAuth'
import { VacanciesPage } from '../pages/public/VacanciesPage' 

const router = createBrowserRouter([
  {
    path: '/',
    element: <Outlet />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/vacancies/:vacancyId', element: <VacancyDetailPage /> },
      { path: '/vacancies', element: <VacanciesPage /> },

      {
        element: <RequireAuth allowedRoles={['applicant']} />,
        children: [{ path: '/applicant', element: <ApplicantPage /> }],
      },
      {
        element: <RequireAuth allowedRoles={['company']} />,
        children: [{ path: '/employer', element: <EmployerPage /> }],
      },
      {
        element: <RequireAuth allowedRoles={['admin']} />,
        children: [{ path: '/admin', element: <AdminPage /> }],
      },
    ],
  },
])

export const AppRouter = () => <RouterProvider router={router} />