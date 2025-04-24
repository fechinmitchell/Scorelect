const confirmSave = async () => {
    if (!datasetName) {
      toast.error("Please enter a dataset name");
      return;
    }
    setSavingInProgress(true);
    try {
      const gameName = youtubeUrl
        ? `YouTube-${getYouTubeVideoId(youtubeUrl)}`
        : videoFile.name.replace(/\.[^/.]+$/, "");
      const gameData = {
        gameName,
        sport,
        matchDate: new Date().toISOString(),
        datasetName,
        youtubeUrl: youtubeUrl || null,
        teamsData,
        analysisType: 'video',
        gameData: tags.map(tag => ({
          action: tag.action,
          category: tag.category,
          team: tag.team,
          playerName: tag.player,
          outcome: tag.outcome,
          timestamp: tag.timestamp,
          x: tag.position.x,
          y: tag.position.y,
          notes: tag.notes,
        })),
      };
      const gameDocRef = doc(
        collection(firestore, 'savedGames', currentUser.uid, 'games'),
        gameData.gameName
      );
      await setDoc(gameDocRef, gameData);
      setSavingInProgress(false);
      setSaveDialogOpen(false);
      toast.success("Game data saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      setSavingInProgress(false);
      toast.error("Error saving data: " + error.message);
    }
  };