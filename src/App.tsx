import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { HomePage } from './pages/HomePage';
import { CreateResourcePage } from './pages/CreateResourcePage';
import { StudyDetailPage } from './pages/StudyDetailPage';
import { ResourceDetailPage } from './pages/ResourceDetailPage';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/resource/new" element={<CreateResourcePage />} />
        <Route path="/study/:id" element={<StudyDetailPage />} />
        <Route path="/resource/:resourceType/:id" element={<ResourceDetailPage />} />
      </Routes>
    </AppLayout>
  );
}
