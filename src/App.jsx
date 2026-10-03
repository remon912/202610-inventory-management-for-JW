import { Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import StatusView from './components/StatusView.jsx';
import ItemListPage from './pages/ItemListPage.jsx';
import ItemDetailPage from './pages/ItemDetailPage.jsx';
import ItemFormPage from './pages/ItemFormPage.jsx';
import MovementPage from './pages/MovementPage.jsx';
import ReportPage from './pages/ReportPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ItemListPage />} />
        <Route path="items/new" element={<ItemFormPage />} />
        <Route path="items/:id" element={<ItemDetailPage />} />
        <Route path="items/:id/edit" element={<ItemFormPage />} />
        <Route path="items/:id/move" element={<MovementPage />} />
        <Route path="reports" element={<ReportPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route
          path="*"
          element={
            <StatusView
              kind="empty"
              title="페이지를 찾을 수 없습니다"
              action={
                <Link to="/" className="btn btn-primary">
                  품목 목록으로
                </Link>
              }
            />
          }
        />
      </Route>
    </Routes>
  );
}
