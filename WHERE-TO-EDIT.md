# Main Airs source

This is the owner's main Git checkout: `C:/Users/DELL/Desktop/flowst-air`.
Newer work recovered from `Downloads/Flowst's Airs/experiments/kai-pilot` now
lives here. That separate experiment remains a backup, not the source to edit.

- [New Session](pages/home/new.vue): mode choices, optional team editor, Misu setup.
- [Team editor](components/AgentCustomizer.vue): skin, hair, eyes and Amina voice.
- [Portrait renderer](components/AgentPortrait.vue): selective color regions.
- [Face animation renderer](components/demo/CompanionMotionAvatar.vue): original
  and matching customized face states, pause and reduced motion.
- [Interaction renderer](components/demo/AminaDemoAvatar.vue): deployed-style
  transparent half-body speaking and gesture samples, separate from face unlocks.
- [Mode demonstrations](pages/home/modes.vue): animation and prepared audio.
- [Recovery details](docs/avatar-animation-recovery.md): assets and boundaries.

Run ` here and open `http://127.0.0.1:4322/home/new`.
The safe local fixture needs no provider credentials and is not a deployment.
Recovery source is now in this Git checkout. Use `git status` to see any pending
follow-ups; source availability does not establish production deployment status.
