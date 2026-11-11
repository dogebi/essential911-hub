import { Link, Route, Routes } from 'react-router-dom'
import { Footer, TopBar } from './components'
import HomePage from './pages/Home'
import VideosPage from './pages/Videos'
import DetailPage from './pages/Detail'
import CategoryPage from './pages/Category'
import TagPage from './pages/TagPage'
import TagsPage from './pages/TagsPage'
import DemosPage from './pages/Demos'
import DemoDetailPage from './pages/DemoDetail'

function NotFound() {
  return (
    <div className="empty">
      <p>찾는 페이지가 없습니다.</p>
      <Link to="/" className="btn-ghost">
        홈으로
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <>
      <TopBar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/demos" element={<DemosPage />} />
          <Route path="/demos/:group" element={<DemosPage />} />
          <Route path="/demo/:id" element={<DemoDetailPage />} />
          <Route path="/c/:slug" element={<CategoryPage />} />
          <Route path="/t/:slug" element={<TagPage />} />
          <Route path="/v/:id" element={<DetailPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
