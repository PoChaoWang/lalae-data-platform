// frontend/src/app/(main)/clients/new/loading.tsx

/**
 * 這是一個為「建立新客戶」表單設計的骨架屏 (Skeleton Screen)。
 */
export default function Loading() {
    return (
      <div className="container mt-4" style={{ maxWidth: '600px' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          {/* 標題的骨架 */}
          <div className="h1 bg-secondary bg-opacity-25 rounded placeholder" style={{ width: '250px', height: '48px' }}></div>
          {/* 返回按鈕的骨架 */}
          <div className="btn btn-outline-secondary disabled placeholder" style={{ width: '100px', height: '38px' }}></div>
        </div>
  
        <div className="card placeholder-glow">
          <div className="card-body">
            {/* 表單欄位的骨架 */}
            <div className="mb-3">
              <label className="form-label">Client Name</label>
              <div className="form-control placeholder" style={{ height: '38px' }}></div>
            </div>
            <div className="mb-3">
              <label className="form-label">Description</label>
              <div className="form-control placeholder" style={{ height: '72px' }}></div>
            </div>
            <div className="mb-3">
               <div className="form-check">
                  <input type="checkbox" className="form-check-input" disabled />
                  <label className="form-check-label">Is Active</label>
              </div>
            </div>
            {/* 提交按鈕的骨架 */}
            <div className="d-grid gap-2">
              <div className="btn btn-primary disabled placeholder" style={{ height: '38px' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  