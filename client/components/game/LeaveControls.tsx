import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { gameActions } from '../../lib/realtime';
import { useUiStore } from '../../store/uiStore';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/** Leave confirmation modal driven by the ui store, so Escape can open it from anywhere. */
export function LeaveModal({ started }: { started: boolean }) {
  const { t } = useTranslation();
  const open = useUiStore((state) => state.leaveModalOpen);
  const setOpen = useUiStore((state) => state.setLeaveModal);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={t('leave.title')} open={open} onClose={() => setOpen(false)}>
      <p className="mb-4 text-ink-2">{started ? t('leave.started') : t('leave.lobby')}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t('common.stay')}
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
          {t('common.leave')}
        </Button>
      </div>
    </Modal>
  );
}

export function LeaveButton() {
  const { t } = useTranslation();
  const setOpen = useUiStore((state) => state.setLeaveModal);
  return (
    <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
      {t('common.leave')}
    </Button>
  );
}
