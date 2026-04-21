import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import Footer from './components/Footer'
import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'

const HomePage = lazy(() => import('./components/HomePage'))
const Login = lazy(() => import('./components/Login'))
const SignUp = lazy(() => import('./components/SignUp'))
const ScanPage = lazy(() => import('./components/ScanPage'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const Profile = lazy(() => import('./components/Profile'))

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-[#dceee2] ${className}`} />
}

function RouteLoader() {
  return (
    <div className="mx-auto min-h-[calc(100vh-153px)] max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="rounded-lg border border-[#14532d]/10 bg-white p-5 shadow-sm sm:p-6">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="mt-4 h-9 w-56" />
          <SkeletonBlock className="mt-4 h-4 w-full" />
          <SkeletonBlock className="mt-2 h-4 w-5/6" />
          <SkeletonBlock className="mt-6 h-80 w-full" />
          <SkeletonBlock className="mt-5 h-12 w-full" />
        </div>

        <div className="rounded-lg bg-[#16351f] p-5 shadow-sm sm:p-6">
          <SkeletonBlock className="h-4 w-32 bg-white/20" />
          <SkeletonBlock className="mt-4 h-9 w-52 bg-white/20" />
          <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5">
            <SkeletonBlock className="h-7 w-48 bg-white/20" />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <SkeletonBlock className="h-36 w-full bg-white" />
              <SkeletonBlock className="h-36 w-full bg-white" />
            </div>
            <SkeletonBlock className="mt-5 h-4 w-full bg-white/20" />
            <SkeletonBlock className="mt-2 h-4 w-11/12 bg-white/20" />
            <SkeletonBlock className="mt-2 h-4 w-4/5 bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-[#f4fbf7] text-[#16351f]">
          <NavBar />
          <main>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route
                  path="/scan"
                  element={
                    <ProtectedRoute>
                      <ScanPage />
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
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
