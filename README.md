# Session métat-robot

Session bot est un méta-robot qui permet d'appeler des plugins depuis l'application session amager

## Run this example


1. Clone this repository or download it as zip and go to `simple` subdirector
2. cd session_bot
3. export CLIENT_NAME='secretarius' (secretarius est un exemple  pour de nom du robot dans session manager)
4. docker compose up -d
5. cat data/session_id.txt (pour avoir l'id permettant de discuter avec le robot depuis session messenger)
6. lancer session messenger et appeler un des plugins décrits dans data/plugins.yaml, par exemple : !echo répète ce que je dis; appelle le plugin test et renvoie la chaîne suivant !echo

