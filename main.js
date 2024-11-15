const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  TextChannel,
} = require("discord.js");
const Trello = require("trello");
require("dotenv").config();

const trelloKey = process.env.TRELLO_KEY;
const trelloToken = process.env.TRELLO_TOKEN;
const trello = new Trello(trelloKey, trelloToken);

// ID du tableau trello
const boardId = process.env.BOARD_ID;

// les IDs de listes Trello
const lists = {
  "1️⃣": "66546fe3a4434f715de2550d", // Backlog
  "2️⃣": "672f4e9675d1d98c45acc4fe", // Tickets validés
  "3️⃣": "672f4ec02d68311fbf3217d3", // En cours
  "4️⃣": "672f4ec621f3fc536871f2e8", // À recetter
  "5️⃣": "672f4ef3e76cc9397e96c8c1", // Traité (attente prod)
  "6️⃣": "672f4efe44a0da712651488a", // En prod / clôturé
  "7️⃣": "672f4f26ca307e5e2897ae5c", // Archive
};

const listNames = {
  "1️⃣": "Backlog",
  "2️⃣": "Tickets validés",
  "3️⃣": "En cours",
  "4️⃣": "À recetter",
  "5️⃣": "Traité (en prod)",
  "6️⃣": "En prod / clôturé",
  "7️⃣": "Archive",
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.once("ready", () => {
  console.log("Bot en ligne!");

  const channelId = process.env.CHANNEL_ID;

  if (!channelId) {
    console.error("La variable CHANNEL_ID n'est pas définie.");
    return;
  }

  const channel = client.channels.cache.get(channelId);

  const sendTicketsEnCoursAlert = async () => {
    const listId = lists["3️⃣"];

    try {
      const cards = await trello.getCardsOnList(listId);

      if (!cards || cards.length === 0) {
        console.log("Il n'y a pas de tickets en cours.");
        return;
      }

      const allMembers = await trello.getBoardMembers(boardId);

      const cardsWithDetails = await Promise.all(
        cards.map(async (card) => {
          const memberNames = card.idMembers.map((memberId) => {
            const member = allMembers.find((m) => m.id === memberId);
            return member ? member.fullName || member.username : "Inconnu";
          });
          card.members = memberNames;

          const labels = await getCardLabelsAsync(card.id);
          card.labels = labels.map((label) => label.name);

          return card;
        })
      );

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Tickets En Cours")
        .setDescription(
          "Voici la liste des tickets en cours avec leurs membres assignés et leurs tags."
        );

      cardsWithDetails.forEach((card) => {
        const members =
          card.members.length > 0
            ? card.members.join(", ")
            : "Aucun membre assigné";

        const tags =
          card.labels.length > 0 ? card.labels.join(", ") : "Aucun tag";

        embed.addFields({
          name: `${card.name} (ID: ${card.idShort})`,
          value: `**Description :** ${
            card.desc || "Pas de description"
          }\n**Assigné à :** ${members}\n**Tags :** ${tags}`,
        });
      });

      if (channel instanceof TextChannel) {
        channel.send({ embeds: [embed] });
      } else {
        console.error("Canal non trouvé ou n'est pas un canal de texte.");
      }
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des tickets en cours :",
        error
      );
    }
  };

  setInterval(sendTicketsEnCoursAlert, 3600000);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const prefix = "!";

  if (!message.content.startsWith(prefix)) return;

  const fullCommand = message.content.slice(prefix.length).trim();
  const spaceIndex = fullCommand.indexOf(" ");

  let command = "";
  let args = "";

  if (spaceIndex === -1) {
    command = fullCommand.toLowerCase();
  } else {
    command = fullCommand.slice(0, spaceIndex).toLowerCase();
    args = fullCommand.slice(spaceIndex + 1);
  }

  const commands = {
    listCards: handleListCards,
    create: handleCreateTask,
    list: handleListTasks,
    done: handleDoneTask,
    progress: handleProgressTask,
    move: handleMoveTask,
    assign: handleAssign,
    unassign: handleUnassign,
    update: handleUpdateTask,
    info: handleInfo,
    members: handleMembers,
    member: handleMember,
    help: handleHelp,
  };

  if (commands[command]) {
    commands[command](message, args);
  } else {
    message.channel.send(
      `Commande inconnue : ${command}. Tapez !help pour la liste des commandes.`
    );
  }
});

async function handleListCards(message, args) {
  const listMessage = await message.channel.send(
    "Choisissez une colonne pour afficher les cartes :\n1️ Backlog\n2️⃣ Tickets validés\n3️⃣ En cours\n4️⃣ À recetter\n5️⃣ Traité (attente prod)\n6️⃣ En prod / clôturé\n7️⃣ Archive"
  );
  for (const emoji of Object.keys(lists)) {
    await listMessage.react(emoji);
  }

  const filter = (reaction, user) => {
    return (
      Object.keys(lists).includes(reaction.emoji.name) &&
      user.id === message.author.id
    );
  };

  listMessage
    .awaitReactions({ filter, max: 1, time: 60000, errors: ["time"] })
    .then(async (collected) => {
      const reaction = collected.first();

      if (!reaction) {
        message.channel.send(
          "Aucune réaction n'a été collectée. Veuillez réessayer."
        );
        return;
      }

      const listId = lists[reaction.emoji.name];

      try {
        const cards = await trello.getCardsOnList(listId);

        if (!cards || cards.length === 0) {
          message.channel.send("Cette liste est vide.");
          return;
        }

        const cardsWithDetails = await Promise.all(
          cards.map(async (card) => {
            if (card.idMembers && card.idMembers.length > 0) {
              const members = await trello.getBoardMembers(card.id);
              card.members = members.map(
                (member) => member.fullName || member.username
              );
            } else {
              card.members = [];
            }

            const labels = await getCardLabelsAsync(card.id);
            card.labels = labels.map((label) => label.name);

            return card;
          })
        );

        let page = 0;
        const cardsPerPage = 10;
        const totalPages = Math.ceil(cardsWithDetails.length / cardsPerPage);

        const generateEmbed = (page) => {
          const start = page * cardsPerPage;
          const end = start + cardsPerPage;
          const currentCards = cardsWithDetails.slice(start, end);

          const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(
              `Cartes dans la liste sélectionnée (Page ${
                page + 1
              }/${totalPages})`
            )
            .setFooter({
              text: "Utilisez ⬅️ et ➡️ pour naviguer entre les pages.",
            });

          currentCards.forEach((card) => {
            const members =
              card.members.length > 0
                ? card.members.join(", ")
                : "Aucun membre assigné";

            const tags =
              card.labels.length > 0 ? card.labels.join(", ") : "Aucun tag";

            embed.addFields({
              name: `${card.name} (ID: ${card.idShort})`,
              value: `**Description :** ${
                card.desc || "Pas de description"
              }\n**Assigné à :** ${members}\n**Tags :** ${tags}`,
            });

            const embedSize = calculateEmbedSize(embed);
            if (embedSize >= 5900) {
              embed.spliceFields(-1, 1);
              return embed;
            }
          });

          return embed;
        };

        let embedMessage = await message.channel.send({
          embeds: [generateEmbed(page)],
        });

        await embedMessage.react("⬅️");
        await embedMessage.react("➡️");

        const reactionFilter = (reaction, user) => {
          return (
            ["⬅️", "➡️"].includes(reaction.emoji.name) &&
            user.id === message.author.id
          );
        };

        const collector = embedMessage.createReactionCollector({
          filter: reactionFilter,
          time: 300000,
        });

        collector.on("collect", async (reaction, user) => {
          reaction.users.remove(user);

          if (reaction.emoji.name === "➡️") {
            if (page < totalPages - 1) {
              page++;
              embedMessage.edit({ embeds: [generateEmbed(page)] });
            }
          } else if (reaction.emoji.name === "⬅️") {
            if (page > 0) {
              page--;
              embedMessage.edit({ embeds: [generateEmbed(page)] });
            }
          }
        });

        collector.on("end", () => {
          embedMessage.reactions
            .removeAll()
            .catch((error) =>
              console.error(
                "Erreur lors de la suppression des réactions :",
                error
              )
            );
        });
      } catch (error) {
        console.error("Erreur lors de la récupération des cartes :", error);
        message.channel.send("Erreur lors de la récupération des cartes.");
      }
    })
    .catch(() => {
      message.channel.send("Temps écoulé pour la sélection de la colonne.");
    });
}

async function handleListTasks(message, args) {
  const listMessage = await message.channel.send(
    "Choisissez une colonne pour afficher les tâches :\n1️⃣ Backlog\n2️⃣ Tickets validés\n3️⃣ En cours\n4️⃣ À recetter\n5️⃣ Traité (en prod)\n6️⃣ En prod / clôturé\n7️⃣ Archive"
  );
  for (const emoji of Object.keys(lists)) {
    await listMessage.react(emoji);
  }

  const filter = (reaction, user) => {
    return (
      Object.keys(lists).includes(reaction.emoji.name) &&
      user.id === message.author.id
    );
  };

  listMessage
    .awaitReactions({ filter, max: 1, time: 60000, errors: ["time"] })
    .then(async (collected) => {
      const reaction = collected.first();

      if (!reaction) {
        message.channel.send(
          "Aucune réaction n'a été collectée. Veuillez réessayer."
        );
        return;
      }

      const listId = lists[reaction.emoji.name];

      if (!listId) {
        message.channel.send("Erreur : Emoji non reconnu. Veuillez réessayer.");
        return;
      }

      try {
        trello.getCardsOnList(listId, async (error, cards) => {
          if (error) {
            console.error("Erreur lors de la récupération des cartes :", error);
            message.channel.send("Erreur lors de la récupération des cartes.");
            return;
          }

          if (!cards || cards.length === 0) {
            message.channel.send("Cette liste est vide.");
            return;
          }

          const allMembers = await trello.getBoardMembers(boardId);

          const cardsWithDetails = await Promise.all(
            cards.map(async (card) => {
              const memberNames = card.idMembers.map((memberId) => {
                const member = allMembers.find((m) => m.id === memberId);
                return member ? member.fullName || member.username : "Inconnu";
              });
              card.members = memberNames;

              const labels = await getCardLabelsAsync(card.id);
              card.labels = labels.map((label) => label.name);

              return card;
            })
          );

          let page = 0;
          const cardsPerPage = 10;
          const totalPages = Math.ceil(cardsWithDetails.length / cardsPerPage);

          const generateEmbed = (page) => {
            const start = page * cardsPerPage;
            const end = start + cardsPerPage;
            const currentCards = cardsWithDetails.slice(start, end);

            const embed = new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle(
                `Cartes dans la liste sélectionnée (Page ${
                  page + 1
                }/${totalPages})`
              )
              .setFooter({
                text: "Utilisez ⬅️ et ➡️ pour naviguer entre les pages.",
              });

            currentCards.forEach((card) => {
              const members =
                card.members.length > 0
                  ? card.members.join(", ")
                  : "Aucun membre assigné";

              const tags =
                card.labels.length > 0 ? card.labels.join(", ") : "Aucun tag";

              embed.addFields({
                name: `${card.name} (ID: ${card.idShort})`,
                value: `**Description :** ${
                  card.desc || "Pas de description"
                }\n**Assigné à :** ${members}\n**Tags :** ${tags}`,
              });

              const embedSize = calculateEmbedSize(embed);
              if (embedSize >= 5900) {
                embed.spliceFields(-1, 1);
                return embed;
              }
            });

            return embed;
          };

          let embedMessage = await message.channel.send({
            embeds: [generateEmbed(page)],
          });

          await embedMessage.react("⬅️");
          await embedMessage.react("➡️");

          const reactionFilter = (reaction, user) => {
            return (
              ["⬅️", "➡️"].includes(reaction.emoji.name) &&
              user.id === message.author.id
            );
          };

          const collector = embedMessage.createReactionCollector({
            filter: reactionFilter,
            time: 300000,
          });

          collector.on("collect", async (reaction, user) => {
            reaction.users.remove(user);

            if (reaction.emoji.name === "➡️") {
              if (page < totalPages - 1) {
                page++;
                embedMessage.edit({ embeds: [generateEmbed(page)] });
              }
            } else if (reaction.emoji.name === "⬅️") {
              if (page > 0) {
                page--;
                embedMessage.edit({ embeds: [generateEmbed(page)] });
              }
            }
          });

          collector.on("end", () => {
            embedMessage.reactions
              .removeAll()
              .catch((error) =>
                console.error(
                  "Erreur lors de la suppression des réactions :",
                  error
                )
              );
          });
        });
      } catch (error) {
        console.error("Erreur lors de la récupération des cartes :", error);
        message.channel.send("Erreur lors de la récupération des cartes.");
      }
    })
    .catch((error) => {
      console.error("Erreur lors de la collecte des réactions :", error);
      message.channel.send(
        "Temps écoulé pour la sélection de la colonne ou une erreur est survenue."
      );
    });
}

async function handleCreateTask(message, args) {
  const input = args
    .join(" ")
    .split("|")
    .map((arg) => arg.trim())
    .filter((arg) => arg !== "");

  if (input.length < 2) {
    message.channel.send(
      "Règle de nommage : Ticket #(n°) : <nom> | <description>\nUtilisation : `!create | <nom> | <description>`"
    );
    return;
  }

  const name = input[0];
  const desc = input[1];

  const listMessage = await message.channel.send(
    "Choisissez une colonne :\n1️⃣ Backlog\n2️⃣ Tickets validés\n3️⃣ En cours\n4️⃣ À recetter\n5️⃣ Traité (attente prod)\n6️⃣ En prod / clôturé\n7️⃣ Archive"
  );
  for (const emoji of Object.keys(lists)) {
    await listMessage.react(emoji);
  }

  const filter = (reaction, user) => {
    return (
      Object.keys(lists).includes(reaction.emoji.name) &&
      user.id === message.author.id
    );
  };

  listMessage
    .awaitReactions({ filter, max: 1, time: 60000, errors: ["time"] })
    .then(async (collected) => {
      const reaction = collected.first();

      if (!reaction) {
        message.channel.send(
          "Aucune réaction n'a été collectée. Veuillez réessayer."
        );
        return;
      }

      const listId = lists[reaction.emoji.name];

      if (!listId) {
        message.channel.send("Erreur : Emoji non reconnu. Veuillez réessayer.");
        return;
      }

      try {
        const card = await trello.addCard(name, desc, listId);
        message.channel.send(
          `✅ **Tâche créée dans la liste sélectionnée :** \`${card.name}\``
        );
      } catch (error) {
        console.error("Erreur lors de la création de la tâche :", error);
        message.channel.send("Erreur lors de la création de la tâche.");
      }
    })
    .catch((error) => {
      console.error("Erreur lors de la collecte des réactions :", error);
      message.channel.send(
        "Temps écoulé pour la sélection de la colonne ou une erreur est survenue."
      );
    });
}

async function handleDoneTask(message, args) {
  const cardIdShort = args[0];

  if (!cardIdShort) {
    message.channel.send(
      "Veuillez fournir l'ID de la carte. Utilisation : `!done <id>`"
    );
    return;
  }

  moveTaskToList(cardIdShort, "En prod / clôturé", message);
}

async function handleProgressTask(message, args) {
  const cardIdShort = args[0];

  if (!cardIdShort) {
    message.channel.send(
      "Veuillez fournir l'ID de la carte. Utilisation : `!progress <id>`"
    );
    return;
  }

  moveTaskToList(cardIdShort, "En cours", message);
}

async function handleMoveTask(message, args) {
  const cardIdShort = args[0];

  if (!cardIdShort) {
    message.channel.send(
      "Veuillez fournir l'ID de la carte. Utilisation : `!move <id>`"
    );
    return;
  }

  const listMessage = await message.channel.send(
    "Choisissez une colonne pour déplacer la carte :\n1️⃣ Backlog\n2️⃣ Tickets validés\n3️⃣ En cours\n4️⃣ À recetter\n5️⃣ Traité (en prod)\n6️⃣ En prod / clôturé\n7️⃣ Archive"
  );
  for (const emoji of Object.keys(lists)) {
    await listMessage.react(emoji);
  }

  const filter = (reaction, user) => {
    return (
      Object.keys(lists).includes(reaction.emoji.name) &&
      user.id === message.author.id
    );
  };

  listMessage
    .awaitReactions({ filter, max: 1, time: 60000, errors: ["time"] })
    .then(async (collected) => {
      const reaction = collected.first();

      if (!reaction) {
        message.channel.send(
          "Aucune réaction n'a été collectée. Veuillez réessayer."
        );
        return;
      }

      const targetListId = lists[reaction.emoji.name];

      if (!targetListId) {
        message.channel.send("Erreur : Emoji non reconnu. Veuillez réessayer.");
        return;
      }

      trello.getCardsOnBoard(boardId, function (error, cards) {
        if (error) {
          console.error("Erreur lors de la récupération des tâches :", error);
          message.channel.send("Erreur lors de la récupération des tâches.");
          return;
        }

        const card = cards.find((c) => c.idShort == cardIdShort);

        if (!card) {
          message.channel.send("Tâche non trouvée avec cet ID.");
          return;
        }

        trello.updateCardList(card.id, targetListId, function (error) {
          if (error) {
            console.error("Erreur lors du déplacement de la tâche :", error);
            message.channel.send("Erreur lors du déplacement de la tâche.");
            return;
          }

          message.channel.send(
            `La tâche **${card.name}** a été déplacée vers la liste sélectionnée.`
          );
        });
      });
    })
    .catch((error) => {
      console.error("Erreur lors de la collecte des réactions :", error);
      message.channel.send(
        "Temps écoulé pour la sélection de la colonne ou une erreur est survenue."
      );
    });
}

async function handleUpdateTask(message, args) {
  const cardIdShort = args.shift();

  if (!cardIdShort) {
    message.channel.send(
      "Veuillez fournir l'ID de la tâche. Utilisation : `!update <id> | <nouveau nom> | <nouvelle description>`"
    );
    return;
  }

  const input = args
    .join(" ")
    .split("|")
    .map((arg) => arg.trim())
    .filter((arg) => arg !== "");

  if (input.length < 2) {
    message.channel.send(
      "Veuillez fournir le nouveau nom et la nouvelle description séparés par `|`. Utilisation : `!update <id> | <nouveau nom> | <nouvelle description>`"
    );
    return;
  }

  const newName = input[0];
  const newDescription = input[1];

  trello.getCardsOnBoard(boardId, function (error, cards) {
    if (error) {
      console.error("Erreur lors de la récupération des tâches :", error);
      message.channel.send("Erreur lors de la récupération des tâches.");
      return;
    }

    const card = cards.find((c) => c.idShort == cardIdShort);

    if (!card) {
      message.channel.send("Tâche non trouvée avec cet ID.");
      return;
    }

    trello.updateCard(
      card.id,
      {
        name: newName,
        desc: newDescription,
      },
      function (error) {
        if (error) {
          console.error("Erreur lors de la mise à jour de la tâche :", error);
          message.channel.send("Erreur lors de la mise à jour de la tâche.");
          return;
        }

        message.channel.send(
          `La tâche **${card.name}** a été mise à jour avec succès.\n**Nouveau nom :** ${newName}\n**Nouvelle description :** ${newDescription}`
        );
      }
    );
  });
}

async function handleMembers(message, args) {
  trello.getBoardMembers(boardId, function (error, members) {
    if (error) {
      console.error("Erreur lors de la récupération des membres :", error);
      message.channel.send("Erreur lors de la récupération des membres.");
      return;
    }

    let memberList = "Membres du tableau :\n";
    members.forEach((member) => {
      memberList += `Nom: ${member.fullName}, ID: ${member.id}\n`;
    });

    message.channel.send(memberList);
  });
}

async function handleAssign(message, args) {
  const cardIdShort = args[0];

  if (!cardIdShort) {
    message.channel.send(
      "Veuillez fournir l'ID de la carte. Utilisation : `!assignMember <cardId>`"
    );
    return;
  }

  trello.getCardsOnBoard(boardId, function (error, cards) {
    if (error) {
      console.error("Erreur lors de la récupération des cartes :", error);
      message.channel.send("Erreur lors de la récupération des cartes.");
      return;
    }

    const card = cards.find((c) => c.idShort == cardIdShort);

    if (!card) {
      message.channel.send("Carte non trouvée avec cet ID.");
      return;
    }

    trello.getBoardMembers(boardId, async function (error, members) {
      if (error) {
        console.error("Erreur lors de la récupération des membres :", error);
        message.channel.send("Erreur lors de la récupération des membres.");
        return;
      }

      let memberMessage = "Choisissez un membre à assigner :\n";
      const memberEmojis = [
        "1️⃣",
        "2️⃣",
        "3️⃣",
        "4️⃣",
        "5️⃣",
        "6️⃣",
        "7️⃣",
        "8️⃣",
        "9️⃣",
        "🔟",
      ];
      members.forEach((member, index) => {
        memberMessage += `${memberEmojis[index]} ${member.fullName}\n`;
      });

      const listMessage = await message.channel.send(memberMessage);

      for (let i = 0; i < members.length && i < memberEmojis.length; i++) {
        await listMessage.react(memberEmojis[i]);
      }

      const filter = (reaction, user) => {
        return (
          memberEmojis.includes(reaction.emoji.name) &&
          user.id === message.author.id
        );
      };

      listMessage
        .awaitReactions({ filter, max: 1, time: 60000, errors: ["time"] })
        .then((collected) => {
          const reaction = collected.first();

          if (!reaction || !reaction.emoji.name) {
            message.channel.send(
              "Aucune réaction n'a été collectée. Veuillez réessayer."
            );
            return;
          }

          const memberIndex = memberEmojis.indexOf(reaction.emoji.name);
          if (memberIndex === -1) {
            message.channel.send("Réaction invalide. Veuillez réessayer.");
            return;
          }

          const memberId = members[memberIndex].id;

          if (card.idMembers.includes(memberId)) {
            message.channel.send(
              `Le membre **${members[memberIndex].fullName}** est déjà assigné à la carte **${card.name}**.`
            );
            return;
          }

          trello.addMemberToCard(card.id, memberId, function (error) {
            if (error) {
              console.error("Erreur lors de l'assignation du membre :", error);
              message.channel.send("Erreur lors de l'assignation du membre.");
              return;
            }

            message.channel.send(
              `Le membre **${members[memberIndex].fullName}** a été assigné à la carte **${card.name}**.`
            );
          });
        })
        .catch((error) => {
          console.error("Erreur lors de la collecte des réactions :", error);
          message.channel.send(
            "Temps écoulé pour la sélection du membre ou une erreur est survenue."
          );
        });
    });
  });
}

async function handleUnassign(message, args) {
  const cardIdShort = args[0];

  if (!cardIdShort) {
    message.channel.send(
      "Veuillez fournir l'ID de la carte. Utilisation : `!unassignTask <cardId>`"
    );
    return;
  }

  trello.getCardsOnBoard(boardId, function (error, cards) {
    if (error) {
      console.error("Erreur lors de la récupération des cartes :", error);
      message.channel.send("Erreur lors de la récupération des cartes.");
      return;
    }

    const card = cards.find((c) => c.idShort == cardIdShort);

    if (!card) {
      message.channel.send("Carte non trouvée avec cet ID.");
      return;
    }

    trello.getBoardMembers(boardId, async function (error, members) {
      if (error) {
        console.error("Erreur lors de la récupération des membres :", error);
        message.channel.send("Erreur lors de la récupération des membres.");
        return;
      }

      const assignedMembers = members.filter((member) =>
        card.idMembers.includes(member.id)
      );

      if (assignedMembers.length === 0) {
        message.channel.send("Aucun membre n'est assigné à cette carte.");
        return;
      }

      let memberMessage = "Choisissez un membre à désassigner :\n";
      const memberEmojis = [
        "1️⃣",
        "2️⃣",
        "3️⃣",
        "4️⃣",
        "5️⃣",
        "6️⃣",
        "7️⃣",
        "8️⃣",
        "9️⃣",
        "🔟",
      ];
      assignedMembers.forEach((member, index) => {
        memberMessage += `${memberEmojis[index]} ${member.fullName}\n`;
      });

      const listMessage = await message.channel.send(memberMessage);

      for (
        let i = 0;
        i < assignedMembers.length && i < memberEmojis.length;
        i++
      ) {
        await listMessage.react(memberEmojis[i]);
      }

      const filter = (reaction, user) => {
        return (
          memberEmojis.includes(reaction.emoji.name) &&
          user.id === message.author.id
        );
      };

      listMessage
        .awaitReactions({ filter, max: 1, time: 60000, errors: ["time"] })
        .then((collected) => {
          const reaction = collected.first();

          if (!reaction || !reaction.emoji.name) {
            message.channel.send(
              "Aucune réaction n'a été collectée. Veuillez réessayer."
            );
            return;
          }

          const memberIndex = memberEmojis.indexOf(reaction.emoji.name);
          if (memberIndex === -1) {
            message.channel.send("Réaction invalide. Veuillez réessayer.");
            return;
          }

          const member = assignedMembers[memberIndex];

          trello.delMemberFromCard(card.id, member.id, function (error) {
            if (error) {
              console.error(
                "Erreur lors de la désassignation du membre :",
                error
              );
              message.channel.send(
                "Erreur lors de la désassignation du membre."
              );
              return;
            }

            message.channel.send(
              `Le membre **${member.fullName}** a été désassigné de la carte **${card.name}**.`
            );
          });
        })
        .catch((error) => {
          console.error("Erreur lors de la collecte des réactions :", error);
          message.channel.send(
            "Temps écoulé pour la sélection du membre ou une erreur est survenue."
          );
        });
    });
  });
}

async function handleInfo(message, args) {
  const cardIdShort = args[0];

  if (!cardIdShort) {
    message.channel.send(
      "Veuillez fournir l'ID de la tâche. Utilisation : `!taskInfo <taskId>`"
    );
    return;
  }

  trello.getCardsOnBoard(boardId, async function (error, cards) {
    if (error) {
      console.error("Erreur lors de la récupération des tâches :", error);
      message.channel.send("Erreur lors de la récupération des tâches.");
      return;
    }

    const card = cards.find((c) => c.idShort == cardIdShort);

    if (!card) {
      message.channel.send("Tâche non trouvée avec cet ID.");
      return;
    }

    try {
      const members = await trello.getBoardMembers(boardId);
      const memberNames = card.idMembers.map((memberId) => {
        const member = members.find((m) => m.id === memberId);
        return member ? member.fullName : "Inconnu";
      });

      const labels = await getCardLabelsAsync(card.id);
      const labelNames =
        labels.map((label) => label.name).join(", ") || "Aucun tag";

      const actions = await getCardActionsAsync(card.id, {
        filter: "commentCard",
      });
      const comments =
        actions.map((action) => `- ${action.data.text}`).join("\n") ||
        "Aucun commentaire";

      const cardInfoEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`Informations sur la tâche : ${card.name}`)
        .addFields(
          {
            name: "Description",
            value: card.desc || "Pas de description",
          },
          {
            name: "Membres assignés",
            value: memberNames.join(", ") || "Aucun membre assigné",
          },
          { name: "Tags", value: labelNames },
          { name: "Commentaires", value: comments },
          {
            name: "Date de dernière activité",
            value: new Date(card.dateLastActivity).toLocaleString(),
          }
        )
        .setFooter({ text: `ID de la tâche : ${card.idShort}` });

      message.channel.send({ embeds: [cardInfoEmbed] });
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des informations de la carte :",
        error
      );
      message.channel.send(
        "Erreur lors de la récupération des informations de la carte."
      );
    }
  });
}

async function handleMember(message, args) {
  trello.getBoardMembers(boardId, async function (error, members) {
    if (error) {
      console.error("Erreur lors de la récupération des membres :", error);
      message.channel.send("Erreur lors de la récupération des membres.");
      return;
    }

    let memberMessage = "Choisissez un membre pour voir ses informations :\n";
    const memberEmojis = [
      "1️⃣",
      "2️⃣",
      "3️⃣",
      "4️⃣",
      "5️⃣",
      "6️⃣",
      "7️⃣",
      "8️⃣",
      "9️⃣",
      "🔟",
    ];
    members.forEach((member, index) => {
      memberMessage += `${memberEmojis[index]} ${member.fullName}\n`;
    });

    const listMessage = await message.channel.send(memberMessage);

    for (let i = 0; i < members.length && i < memberEmojis.length; i++) {
      await listMessage.react(memberEmojis[i]);
    }

    const filter = (reaction, user) => {
      return (
        memberEmojis.includes(reaction.emoji.name) &&
        user.id === message.author.id
      );
    };

    listMessage
      .awaitReactions({ filter, max: 1, time: 60000, errors: ["time"] })
      .then((collected) => {
        const reaction = collected.first();

        if (!reaction || !reaction.emoji.name) {
          message.channel.send(
            "Aucune réaction n'a été collectée. Veuillez réessayer."
          );
          return;
        }

        const memberIndex = memberEmojis.indexOf(reaction.emoji.name);
        if (memberIndex === -1) {
          message.channel.send("Réaction invalide. Veuillez réessayer.");
          return;
        }

        const member = members[memberIndex];

        trello.getCardsOnBoard(boardId, function (error, cards) {
          if (error) {
            console.error("Erreur lors de la récupération des cartes :", error);
            message.channel.send("Erreur lors de la récupération des cartes.");
            return;
          }

          const assignedCards = cards.filter((card) =>
            card.idMembers.includes(member.id)
          );

          const memberInfoEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`Informations sur le membre : ${member.fullName}`)
            .addFields(
              { name: "Nom d'utilisateur", value: member.username },
              { name: "ID", value: member.id },
              {
                name: "Tâches assignées",
                value:
                  assignedCards.length > 0
                    ? assignedCards.map((card) => `- ${card.name}`).join("\n")
                    : "Aucune tâche assignée",
              }
            )
            .setFooter({ text: `ID du membre : ${member.id}` });

          message.channel.send({ embeds: [memberInfoEmbed] });
        });
      })
      .catch((error) => {
        console.error("Erreur lors de la collecte des réactions :", error);
        message.channel.send(
          "Temps écoulé pour la sélection du membre ou une erreur est survenue."
        );
      });
  });
}

async function handleHelp(message, args) {
  const helpEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Liste des commandes disponibles")
    .setDescription(
      "!create : Crée une tâche.\n" +
        "!list : Liste les tâches dans la colonne sélectionnée.\n" +
        "!move : Déplace une tâche vers la colonne sélectionnée.\n" +
        "!update : Met à jour une tâche.\n" +
        "!info : Affiche les informations d'une tâche précise.\n\n" +
        "!members : Liste les membres du tableau.\n" +
        "!member : Affiche les informations d'un membre précis.\n\n" +
        "!assign : Assigne une tâche à un membre.\n" +
        "!unassign : Désassigne une tâche à un membre précis.\n\n" +
        "!done : Marque une tâche comme terminée.\n" +
        "!progress : Marque une tâche en progression.\n\n" +
        "!help : Affiche la liste des commandes disponibles."
    )
    .setFooter({
      text: "Utilisez ces commandes pour interagir avec le bot. \n©2024 Joran Vanpeene.",
    });

  message.channel.send({ embeds: [helpEmbed] });
}

client.login(process.env.TOKEN);

function moveTaskToList(cardIdShort, targetListName, message) {
  const targetListEntry = Object.entries(listNames).find(
    ([emoji, name]) => name === targetListName
  );

  if (!targetListEntry) {
    message.channel.send("Liste cible non trouvée.");
    return;
  }

  const targetListId = lists[targetListEntry[0]];

  if (!targetListId) {
    message.channel.send("ID de liste introuvable.");
    return;
  }

  trello.getCardsOnBoard(boardId, function (error, cards) {
    if (error) {
      console.error("Erreur lors de la récupération des tâches :", error);
      message.channel.send("Erreur lors de la récupération des tâches.");
      return;
    }

    const card = cards.find((c) => c.idShort == cardIdShort);

    if (!card) {
      message.channel.send("Carte non trouvée avec cet ID.");
      return;
    }

    trello.updateCardList(card.id, targetListId, function (error) {
      if (error) {
        console.error("Erreur lors du déplacement de la tâche :", error);
        message.channel.send("Erreur lors du déplacement de la tâche.");
        return;
      }

      message.channel.send(
        `La tâche **${card.name}** a été déplacée vers **${targetListName}**.`
      );
    });
  });
}

function calculateEmbedSize(embed) {
  let totalSize = 0;
  if (embed.data.title) totalSize += embed.data.title.length;
  if (embed.data.description) totalSize += embed.data.description.length;
  if (embed.data.footer && embed.data.footer.text)
    totalSize += embed.data.footer.text.length;
  if (embed.data.author && embed.data.author.name)
    totalSize += embed.data.author.name.length;
  if (embed.data.fields && embed.data.fields.length > 0) {
    embed.data.fields.forEach((field) => {
      totalSize +=
        (field.name ? field.name.length : 0) +
        (field.value ? field.value.length : 0);
    });
  }
  return totalSize;
}

function getCardLabelsAsync(cardId) {
  return new Promise((resolve, reject) => {
    trello.makeRequest(
      "get",
      `/1/cards/${cardId}/labels`,
      {},
      (error, labels) => {
        if (error) return reject(error);
        resolve(labels);
      }
    );
  });
}

function getCardActionsAsync(cardId, options) {
  return new Promise((resolve, reject) => {
    const params = { filter: options.filter || "all" };
    trello.makeRequest(
      "get",
      `/1/cards/${cardId}/actions`,
      params,
      (error, actions) => {
        if (error) return reject(error);
        resolve(actions);
      }
    );
  });
}
