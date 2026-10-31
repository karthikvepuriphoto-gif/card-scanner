interface SavedScreenProps {
  name: string;
  photoUrl: string;
  onScanNext: () => void;
  onViewList: () => void;
}

export function SavedScreen({ name, photoUrl, onScanNext, onViewList }: SavedScreenProps) {
  return (
    <section className="screen saved-screen">
      <header className="topbar">
        <span className="top-spacer" />
        <h1>Saved</h1>
        <span className="top-spacer" />
      </header>
      <div className="saved-body">
        <img src={photoUrl} alt="" className="saved-photo" />
        <p className="saved-kicker">On this phone</p>
        <h2>{name || 'Contact'} is saved here.</h2>
        <p className="fine">
          Your contacts app should be asking to add them. If you closed that sheet, open Saved and tap Add to contacts again.
        </p>
      </div>
      <footer className="dock stack">
        <button type="button" className="primary" onClick={onScanNext}>
          Scan next card
        </button>
        <button type="button" className="secondary" onClick={onViewList}>
          View saved cards
        </button>
      </footer>
    </section>
  );
}
