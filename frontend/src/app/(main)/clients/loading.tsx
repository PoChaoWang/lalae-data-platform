// frontend/src/app/(main)/clients/loading.tsx
/**
 * 這是一個「骨架屏 (Skeleton Screen)」元件。
 * 它會模擬最終頁面的佈局，但用灰色的方塊來代替真實內容。
 * 這比單純的轉圈圈能提供更好的使用者體驗。
 */
export default function Loading() {
    // 您可以任意設計這個載入中畫面
    // 這裡我們建立一個和客戶列表表格結構一樣的骨架屏
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h1 bg-secondary bg-opacity-25 rounded" style={{ width: '150px', height: '48px' }}>&nbsp;</h1>
          <div className="btn btn-primary disabled" style={{ width: '150px', height: '48px' }}>&nbsp;</div>
        </div>
        <div className="table-responsive">
          <table className="table table-striped">
            <thead className="table-dark">
              <tr>
                <th>Name</th>
                <th>BigQuery Dataset ID</th>
                <th>Status</th>
                <th>Created</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              {/* 產生 5 行骨架作為預載入效果 */}
              {Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="placeholder-glow">
                  <td><span className="placeholder col-8"></span></td>
                  <td><span className="placeholder col-10"></span></td>
                  <td><span className="placeholder col-6"></span></td>
                  <td><span className="placeholder col-7"></span></td>
                  <td><span className="placeholder col-5"></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  