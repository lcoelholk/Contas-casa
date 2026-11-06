import { registerSW } from 'virtual:pwa-register'

/**
 * Mantém o app instalado sempre na versão publicada.
 * O service worker guarda os arquivos para abrir rápido; sem isto, uma versão nova
 * só aparecia depois de fechar e abrir o app duas vezes. Aqui ele procura atualização
 * ao abrir, ao voltar para o app e a cada hora, e recarrega sozinho quando encontra.
 */
export function manterAtualizado() {
  if (!('serviceWorker' in navigator)) return
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registro) {
      if (!registro) return
      const procurar = () => {
        if (navigator.onLine) registro.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') procurar()
      })
      setInterval(procurar, 60 * 60 * 1000)
    },
  })
}
