SVG NETWORK COLLECTOR - WINDOWS ET LINUX

Cette application capture les pages SVG chargées par les lecteurs web et les
assemble en PDF. Elle peut notamment fonctionner avec certaines publications
de type Calaméo, catalogues et brochures en ligne.

Utilisez-la uniquement pour des contenus que vous avez le droit de télécharger,
d'archiver ou de convertir.

INSTALLATION SOUS WINDOWS
1. La version fournie par Codex peut être lancée directement avec
   « Lancer SVG Collector.cmd ».
2. Sur un autre ordinateur Windows, installez Node.js 18 ou plus récent,
   lancez « Installer Windows.cmd » une fois, puis le lanceur.

INSTALLATION SOUS LINUX
1. Installez Node.js 18 ou plus récent et npm.
2. Ouvrez un terminal dans le dossier de l'application.
3. Exécutez : bash "Installer Linux.sh"
4. Démarrez ensuite avec : bash "Lancer SVG Collector.sh"

UTILISATION
1. Lancez l'application avec le fichier correspondant à votre système.
2. Entrez l'adresse d'un site dans le tableau de bord.
3. Naviguez normalement dans l'onglet qui s'ouvre.
4. Tous les SVG détectés sont enregistrés dans :
   Bureau/SVG Network Downloads
5. Prévisualisez les vignettes, sélectionnez celles à conserver et supprimez
   les autres si nécessaire.
6. Cliquez sur « Valider et créer le PDF » : chaque SVG sélectionné devient
   une page A4 du PDF final, enregistré dans le même dossier.

ORDRE DES PAGES
- Par défaut, les fichiers sont affichés du premier capturé au dernier.
- Glissez-déposez les vignettes pour définir votre propre ordre.
- Les boutons gauche/droite sous chaque vignette permettent aussi de la déplacer.
- Le numéro affiché sur la vignette correspond à sa future page dans le PDF.
- Cliquez sur ce numéro, saisissez une nouvelle position puis appuyez sur Entrée :
  la page prend cette place et toutes les autres se décalent automatiquement.
- Le changement n'est validé qu'avec Entrée ; la galerie cesse de s'actualiser
  pendant la saisie afin de ne jamais interrompre un numéro à plusieurs chiffres.
- Mettre la capture en pause ne modifie jamais l'ordre manuel de la galerie.
- La croix rouge supprime un fichier ; « Supprimer la sélection » efface tous
  les fichiers cochés après confirmation.

L'application détecte les adresses terminant par .svg/.svgz ainsi que les
réponses dont le type réseau est image/svg+xml. Les doublons d'une même URL
ne sont enregistrés qu'une fois par session.

Sous Linux, Chromium est utilisé. Sous Windows, Edge est utilisé en priorité.
Le dossier Bureau Linux est détecté via la configuration XDG, y compris quand
il porte un nom localisé comme « Bureau ».

Fermez la fenêtre du navigateur pour arrêter l'application.
