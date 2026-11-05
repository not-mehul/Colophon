<script lang="ts">
  // The camera modal for scanning an ISBN where the Code Scanner isn't
  // available (iOS, browsers). Stacks above whatever is open; back cancels.
  import { makeDecoder } from '../platform/barcode';
  import { ui } from '../state/ui.svelte';
  import Icon from './ui/Icon.svelte';

  interface Props {
    stream: MediaStream;
    onDone: (result: string | null) => void;
  }

  let { stream, onDone }: Props = $props();
  let dialog: HTMLDialogElement;
  let video: HTMLVideoElement;
  let done = false;

  const SCAN_INTERVAL_MS = 180;

  function finish(result: string | null) {
    if (done) return;
    done = true;
    dialog.close();
    onDone(result);
  }

  $effect(() => {
    video.srcObject = stream;
    dialog.showModal();
    const release = ui.pushOverlay(() => finish(null));
    video.play().catch(() => finish(null));
    let busy = false;
    let decode: Awaited<ReturnType<typeof makeDecoder>> | null = null;
    void makeDecoder().then((d) => (decode = d));
    const timer = setInterval(async () => {
      if (done || busy || !decode || video.readyState < 2) return;
      busy = true;
      try {
        const code = await decode(video);
        if (code) finish(code);
      } catch {
        // A frame that didn't decode: keep scanning.
      } finally {
        busy = false;
      }
    }, SCAN_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      release();
    };
  });
</script>

<dialog
  bind:this={dialog}
  class="scanner-dialog"
  aria-label="Scan an ISBN barcode"
  oncancel={(ev) => {
    ev.preventDefault();
    finish(null);
  }}
>
  <video bind:this={video} class="scanner-video" playsinline muted></video>
  <div class="scanner-frame" aria-hidden="true"></div>
  <p class="scanner-hint">Point the camera at the barcode on the back cover</p>
  <button type="button" class="btn-icon scanner-cancel" aria-label="Cancel scan" onclick={() => finish(null)}>
    <Icon name="x" />
  </button>
</dialog>
