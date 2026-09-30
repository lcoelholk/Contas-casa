import { Route, Routes } from 'react-router-dom'
import Inicio from './pages/Inicio.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="*" element={<Inicio />} />
    </Routes>
  )
}
