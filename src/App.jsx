import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom';
import './App.css';
import './i18n';
import LanguageSelector from './components/LanguageSelector';
import HospitalForm from './components/HospitalForm';
import LoadingPage from './pages/Loading.jsx';
import ReportLoading from './pages/ReportLoading.jsx';
import ReportPage from './pages/Report.jsx';
import ResultsPage from './pages/Results.jsx';

function PersonaPage() {
  const navigate = useNavigate();
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('hospitalForm');
      if (saved) {
        // eslint-disable-next-line no-console
        console.log('Persona input (from hospital form):', JSON.parse(saved));
      }
    } catch (e) {
      // noop
    }
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h2 className="page-title">Persona Page (placeholder)</h2>
        <p className="muted">The next step will use the submitted form data.</p>
        <button className="primary-btn" onClick={() => navigate('/')}>← Back</button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <header className="app-header">
        <Link to="/" className="branding" aria-label="YukiHaru AI" style={{ textDecoration: 'none' }}>
          <span className="brand-gray">YukiHaru</span>
          <span className="brand-green"> AI</span>
        </Link>
        <LanguageSelector />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HospitalForm />} />
          <Route path="/loading" element={<LoadingPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/report-loading" element={<ReportLoading />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/persona" element={<PersonaPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
