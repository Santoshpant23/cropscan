import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'

const HomePage = lazy(() => import('./components/HomePage'))
const Login = lazy(() => import('./components/Login'))
const ForgotPassword = lazy(() => import('./components/ForgotPassword'))
const SignUp = lazy(() => import('./components/SignUp'))
const SupportedPlants = lazy(() => import('./components/SupportedPlants'))
const ScanPage = lazy(() => import('./components/ScanPage'))
const WalkScanPage = lazy(() => import('./components/WalkScanPage'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const PlotsPage = lazy(() => import('./components/PlotsPage'))
const PlotDetailPage = lazy(() => import('./components/PlotDetailPage'))
const Profile = lazy(() => import('./components/Profile'))
const NotFound = lazy(() => import('./components/NotFound'))

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gradient-to-r from-surface-2 via-surface to-surface-2 ${className}`}
    />
  )
}

function RouteLoader() {
  return (
    <div className="crop-fade-up mx-auto w-full max-w-md px-6 py-8 sm:max-w-2xl lg:max-w-4xl lg:px-8">
      <SkeletonBlock className="h-4 w-28" />
      <SkeletonBlock className="mt-3 h-8 w-3/4" />
      <SkeletonBlock className="mt-3 h-4 w-full" />
      <SkeletonBlock className="mt-2 h-4 w-5/6" />
      <SkeletonBlock className="mt-6 h-56 w-full" />
      <SkeletonBlock className="mt-4 h-12 w-full" />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/supported-plants" element={<SupportedPlants />} />
              <Route
                path="/scan"
                element={
                  <ProtectedRoute>
                    <ScanPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/walk"
                element={
                  <ProtectedRoute>
                    <WalkScanPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/plots"
                element={
                  <ProtectedRoute>
                    <PlotsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/plots/:plotId"
                element={
                  <ProtectedRoute>
                    <PlotDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
