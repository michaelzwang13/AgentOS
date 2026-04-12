import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Page1 from './pages/Page1'
import Page2 from './pages/Page2'
import Page3 from './pages/Page3'
import Page4 from './pages/Page4'
import Page5 from './pages/Page5'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/1" element={<Page1 />} />
        <Route path="/2" element={<Page2 />} />
        <Route path="/3" element={<Page3 />} />
        <Route path="/4" element={<Page4 />} />
        <Route path="/5" element={<Page5 />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
