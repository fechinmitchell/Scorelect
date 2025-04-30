import React, { useState, useRef, useEffect } from 'react';
import { Paper, Avatar, Box, Typography, IconButton, Tooltip } from '@mui/material';
import { FaHistory, FaMicrochip } from 'react-icons/fa';
import StorageIcon from '@mui/icons-material/Storage';
import LockIcon from '@mui/icons-material/Lock';

const RecentGameItem = ({ game, onSelect, onDatasetAnalyse, onAIAnalyse }) => {
  const [hover, setHover] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef(null);

  /* detect overflow for marquee effect */
  useEffect(() => {
    const check = () => {
      if (textRef.current) {
        setIsOverflowing(textRef.current.scrollWidth > textRef.current.clientWidth);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [game.gameName]);

  const formattedDate = game.matchDate
    ? new Date(game.matchDate).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })
    : 'No date';

  return (
    <Paper
      elevation={hover ? 3 : 1}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(game)}
      sx={{
        display:'flex', alignItems:'center', p:1.5, mb:1.5,
        background: hover ? '#2a2a2a' : '#222',
        border:'1px solid', borderColor: hover ? '#444' : '#333',
        borderRadius:2, cursor:'pointer',
        transition:'all 0.2s ease',
        '&:hover':{ transform:'translateX(5px)' }
      }}
    >
      <Avatar sx={{ bgcolor:'rgba(94,46,143,.2)', mr:2, color:'#9254de' }}>
        <FaHistory />
      </Avatar>

      {/* name + date (click loads game) */}
      <Box sx={{ flexGrow:1, overflow:'hidden' }}>
        <Box
          ref={textRef}
          sx={{
            fontWeight:600, color:'#eee', whiteSpace:'nowrap',
            overflow:'hidden', textOverflow:'ellipsis',
            ...(isOverflowing && hover && {
              animation:'scrollText 6s linear infinite',
              '@keyframes scrollText':{
                '0%':{ transform:'translateX(0%)' },
                '20%':{ transform:'translateX(0%)' },
                '80%':{ transform:'translateX(calc(-100% + 180px))' },
                '100%':{ transform:'translateX(0%)' }
              }
            })
          }}
        >
          {game.gameName}
        </Box>
        <Typography variant="caption" sx={{ color:'#999' }}>
          {formattedDate}
        </Typography>
      </Box>

      {/* --- little buttons --- */}
      <Tooltip title="Open in Dataset Analysis">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onDatasetAnalyse(game); }}
        >
          <StorageIcon sx={{ fontSize:18, color:'#5e2e8f' }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Advanced AI analysis (coming soon)">
        <span>
          <IconButton
            size="small"
            disabled
            onClick={(e) => { e.stopPropagation(); onAIAnalyse(); }}
          >
            <FaMicrochip style={{ fontSize:14, color:'#888' }} />
            <LockIcon sx={{ fontSize:10, position:'absolute', right:0, bottom:0, color:'#888' }} />
          </IconButton>
        </span>
      </Tooltip>
    </Paper>
  );
};

export default RecentGameItem;
