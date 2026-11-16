import { useState } from 'react';
import { t } from '../../i18n/en';
import { gameActions } from '../../lib/realtime';
import { useUiStore } from '../../store/uiStore';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/** Leave confirmation modal driven by the ui store, so Escape can open it from anywhere. */
export function LeaveModal({ started }: { started: boolean }) {
  const open = useUiStore((state) => state.leaveModalOpen);
  const setOpen = useUiStore((state) => state.setLeaveModal);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Leave this room?" open={open} onClose={() => setOpen(false)}>
      <p className="mb-4 text-ink-2">
        {started
          ? 'Your score will be kept, but you cannot return to the match.'
          : 'You can join again with the room code.'}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t.stay}
        </Button>
        <Button
          variant="danger"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await gameActions.leaveRoom();
            } catch {
              /* the room is already gone: local state is cleared anyway */
            } finally {
              setBusy(false);
              setOpen(false);
            }
          }}
        >
          {t.leave}
        </Button>
      </div>
    </Modal>
  );
}

export function LeaveButton() {
  const setOpen = useUiStore((state) => state.setLeaveModal);
  return (
    <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
      {t.leave}
    </Button>
  );
}
