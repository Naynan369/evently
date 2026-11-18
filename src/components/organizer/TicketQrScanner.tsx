"use client";

import { useEffect, useRef, useState } from "react";
import { FiCamera, FiX } from "react-icons/fi";
import { useApp } from "@/components/AppProvider";
import styles from "@/styles/TicketQrScanner.module.css";

type ScanIssue = "secure" | "permission" | "unavailable" | "other" | "unrecognized";

export default function TicketQrScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const { t } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const onCloseRef = useRef(onClose);
  const [ready, setReady] = useState(false);
  const [issue, setIssue] = useState<ScanIssue | null>(null);

  useEffect(() => {
    onCodeRef.current = onCode;
    onCloseRef.current = onClose;
  }, [onCode, onClose]);

  useEffect(() => {
    let closed = false;
    let scanned = false;
    let stop: (() => void) | undefined;

    async function start() {
      if (!window.isSecureContext) {
        setIssue("secure");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setIssue("unavailable");
        return;
      }

      try {
        // Load the decoder only after the organizer opens the camera.
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (closed || !videoRef.current) return;

        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 180,
        });
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result, _error, activeControls) => {
            if (!result || closed || scanned) return;
            const code = result.getText().trim().toUpperCase();
            if (!/^EV-[A-F0-9]{16}$/.test(code)) {
              setIssue("unrecognized");
              return;
            }
            scanned = true;
            activeControls.stop();
            onCodeRef.current(code);
          },
        );
        if (closed || scanned) controls.stop();
        else {
          stop = () => controls.stop();
          setReady(true);
        }
      } catch (error) {
        if (closed) return;
        const name = error instanceof Error ? error.name : "";
        setIssue(
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "permission"
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "unavailable"
              : "other",
        );
      }
    }

    function stopWhenHidden() {
      if (document.hidden) onCloseRef.current();
    }

    document.addEventListener("visibilitychange", stopWhenHidden);
    void start();
    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", stopWhenHidden);
      stop?.();
    };
  }, []);

  const issueText = issue
    ? t(
        ({
          secure: "studio.cameraSecure",
          permission: "studio.cameraPermission",
          unavailable: "studio.cameraUnavailable",
          other: "studio.cameraError",
          unrecognized: "studio.cameraWrongCode",
        } as const)[issue],
      )
    : null;

  return (
    <div className={styles.scanner}>
      <div className={styles.header}>
        <span><FiCamera aria-hidden="true" /> {t("studio.cameraTitle")}</span>
        <button type="button" onClick={onClose} aria-label={t("studio.cameraClose")}>
          <FiX aria-hidden="true" />
        </button>
      </div>
      <div className={styles.viewport}>
        <video ref={videoRef} autoPlay muted playsInline aria-label={t("studio.cameraPreview")} />
        <span className={styles.frame} aria-hidden="true" />
        {!ready && !issue && <span className={styles.starting}>{t("studio.cameraStarting")}</span>}
      </div>
      <p className={styles.help}>{t("studio.cameraHelp")}</p>
      {issueText && <p className={styles.issue} role="status">{issueText}</p>}
    </div>
  );
}
