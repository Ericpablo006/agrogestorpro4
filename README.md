# AgroGestor Pro - Login + Mapa + Agenda

Versão mantendo o sistema como estava antes, com:

- Login por e-mail/senha no Firebase Authentication.
- Cadastro de usuário no Firebase.
- Login com Google.
- Login Apple/iCloud preparado via provedor Apple do Firebase.
- Cadastro de produtores no Firestore.
- Documentos no Firebase Storage.
- Aba Mapa com mini mapa, Google Maps, Google Earth e captura de GPS.
- Aba Agenda com visitas técnicas, vistorias, renovação da CAF/CAR, validade de documentos e lembretes.
- Login reorganizado automaticamente no celular.
- Sem IA e sem aba CAR/SEIA.

## Importante
Para Google e Apple/iCloud funcionarem, ative os provedores em:
Firebase Console > Authentication > Sign-in method.

Para publicar:

```bash
firebase login
firebase deploy
```


## Atualização Perfil

Esta versão inclui a aba **Perfil**, onde o usuário logado pode alterar nome, CPF, telefone e senha pelo Firebase Authentication/Firestore.

## Atualização solicitada

- Adicionado Telefone/WhatsApp do cônjuge na aba Produtor.
- Agência e Conta aceitam hífen (-), letra X e não têm limite de caracteres.
- Removido o campo Número da proposta da aba Projeto, do PDF, da planilha e da validação de progresso.
