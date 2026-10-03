import { Navigate, Route, Routes } from 'react-router-dom'
import { supabaseConfigurado } from './lib/supabase.ts'
import { AuthProvider } from './lib/auth.tsx'
import { CompetenciaProvider } from './hooks/useCompetencia.tsx'
import { ExigeMembro } from './components/ExigeMembro.tsx'
import { Layout } from './components/Layout.tsx'
import SemConfiguracao from './pages/SemConfiguracao.tsx'
import Login from './pages/Login.tsx'
import Resumo from './pages/Resumo.tsx'
import ContaPage from './pages/ContaPage.tsx'
import Configuracoes from './pages/Configuracoes.tsx'
import Graficos from './pages/Graficos.tsx'
import Metas from './pages/Metas.tsx'

export default function App() {
  // Sem .env.local preenchido, mostra só a tela de configuração
  if (!supabaseConfigurado) return <SemConfiguracao />

  return (
    <AuthProvider>
      <CompetenciaProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ExigeMembro>
                <Layout />
              </ExigeMembro>
            }
          >
            <Route index element={<Resumo />} />
            <Route path="conta/:id" element={<ContaPage />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="graficos" element={<Graficos />} />
            <Route path="metas" element={<Metas />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CompetenciaProvider>
    </AuthProvider>
  )
}
