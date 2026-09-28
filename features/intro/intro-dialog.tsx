"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Icon } from "@/components/ui/icon";
import { hasSeenIntro, readIntro, writeIntroSeen } from "@/lib/domain/intro";

import { INTRO_STEPS } from "./intro-steps";
import styles from "./intro-dialog.module.css";

const INTRO_CHANGE_EVENT = "instamusic-intro-change";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(INTRO_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(INTRO_CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot(): string {
  return hasSeenIntro(readIntro()) ? "seen" : "new";
}

function getServerSnapshot(): string {
  return "seen";
}

export function IntroDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const open = status === "new";
  const [step, setStep] = useState(0);

  const dismiss = useCallback(() => {
    writeIntroSeen();
    window.dispatchEvent(new Event(INTRO_CHANGE_EVENT));
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (!open) {
      if (dialog.open) {
        dialog.close();
      }
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    const onCancel = (event: Event) => {
      event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
    };

    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("keydown", onKeyDown);
    };
  }, [dismiss, open]);

  const current = INTRO_STEPS[step];
  const last = step === INTRO_STEPS.length - 1;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="intro-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          event.stopPropagation();
        }
      }}
    >
      {open && current ? (
        <div className={styles.panel}>
          <header className={styles.header}>
            <h2 className={styles.dialogName} id="intro-title">
              How to use InstaMusic Finder
            </h2>
            <button className={styles.close} type="button" onClick={dismiss} aria-label="Close">
              <Icon name="close" width="18" height="18" />
            </button>
          </header>

          <div className={styles.step} key={current.src}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.image} src={current.src} alt={current.alt} />
            <h3 className={styles.heading}>{current.title}</h3>
            <p className={styles.body}>{current.body}</p>
            <p className={styles.progress}>{`${step + 1} of ${INTRO_STEPS.length}`}</p>
          </div>

          <div className={styles.actions}>
            {step > 0 ? (
              <button className={styles.back} type="button" onClick={() => setStep((value) => value - 1)}>
                Back
              </button>
            ) : null}
            <button
              className={styles.next}
              type="button"
              onClick={() => {
                if (last) {
                  dismiss();
                  return;
                }
                setStep((value) => value + 1);
              }}
            >
              {last ? "Start searching" : "Next"}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
