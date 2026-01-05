import React, { memo, useState, useRef, useEffect } from 'react';
import classNames from 'classnames';
import { TrendingUp, ChevronDown, Plus, Pencil, Trash2, Copy, X, Check } from 'lucide-react';
import styles from './PositionTrackerHeader.module.css';

const PositionTrackerHeader = memo(({
  sourceMode,
  onSourceModeChange,
  marketStatus,
  isMarketOpen,
  symbolCount,
  // List management props
  lists = [],
  activeListId,
  activeList,
  onSwitchList,
  onCreateList,
  onRenameList,
  onDeleteList,
  onCopyList,
  onClearList,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [createName, setCreateName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const dropdownRef = useRef(null);
  const createInputRef = useRef(null);
  const editInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setShowCreateInput(false);
        setEditingId(null);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Focus create input when shown
  useEffect(() => {
    if (showCreateInput && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [showCreateInput]);

  // Focus edit input when editing
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleCreateSubmit = () => {
    const trimmedName = createName.trim();
    if (trimmedName && onCreateList) {
      onCreateList(trimmedName);
      setCreateName('');
      setShowCreateInput(false);
      setShowDropdown(false);
    }
  };

  const handleEditSubmit = (id) => {
    const trimmedName = editName.trim();
    if (trimmedName && onRenameList) {
      onRenameList(id, trimmedName);
    }
    setEditingId(null);
    setEditName('');
  };

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    if (onDeleteList) {
      onDeleteList(id);
    }
  };

  const handleCopyClick = (e, id) => {
    e.stopPropagation();
    const list = lists.find(l => l.id === id);
    if (list && onCopyList) {
      onCopyList(id, `${list.name} (Copy)`);
      setShowDropdown(false);
    }
  };

  const handleListClick = (id) => {
    if (editingId) return;
    if (onSwitchList) {
      onSwitchList(id);
    }
    setShowDropdown(false);
  };

  const startEditing = (e, id, name) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(name);
  };

  const currentListName = activeList?.name || 'My Positions';

  return (
    <div className={styles.header}>
      {/* Title Row with List Selector */}
      <div className={styles.titleRow}>
        <div className={styles.titleLeft}>
          <TrendingUp size={16} className={styles.titleIcon} />
          <div className={styles.listSelector} ref={dropdownRef}>
            <button
              className={styles.listSelectorBtn}
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <span className={styles.listName}>{currentListName}</span>
              <ChevronDown size={14} className={classNames(styles.chevron, showDropdown && styles.chevronOpen)} />
            </button>

            {showDropdown && (
              <div className={styles.dropdown}>
                {/* Create new list */}
                {showCreateInput ? (
                  <div className={styles.createInputRow}>
                    <input
                      ref={createInputRef}
                      type="text"
                      className={styles.listInput}
                      placeholder="List name"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateSubmit();
                        if (e.key === 'Escape') {
                          setShowCreateInput(false);
                          setCreateName('');
                        }
                      }}
                    />
                    <button className={styles.iconBtn} onClick={handleCreateSubmit}>
                      <Check size={14} />
                    </button>
                    <button className={styles.iconBtn} onClick={() => {
                      setShowCreateInput(false);
                      setCreateName('');
                    }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.createBtn}
                    onClick={() => setShowCreateInput(true)}
                  >
                    <Plus size={14} />
                    <span>Create new list</span>
                  </button>
                )}

                <div className={styles.dropdownDivider} />

                {/* List items */}
                <div className={styles.listItems}>
                  {lists.map(list => (
                    <div
                      key={list.id}
                      className={classNames(
                        styles.listItem,
                        list.id === activeListId && styles.listItemActive
                      )}
                      onClick={() => handleListClick(list.id)}
                    >
                      {editingId === list.id ? (
                        <div className={styles.editInputRow}>
                          <input
                            ref={editInputRef}
                            type="text"
                            className={styles.listInput}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditSubmit(list.id);
                              if (e.key === 'Escape') {
                                setEditingId(null);
                                setEditName('');
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button className={styles.iconBtn} onClick={(e) => {
                            e.stopPropagation();
                            handleEditSubmit(list.id);
                          }}>
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className={styles.listItemName}>{list.name}</span>
                          <div className={styles.listItemActions}>
                            <button
                              className={styles.actionBtn}
                              onClick={(e) => startEditing(e, list.id, list.name)}
                              title="Rename"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              className={styles.actionBtn}
                              onClick={(e) => handleCopyClick(e, list.id)}
                              title="Duplicate"
                            >
                              <Copy size={12} />
                            </button>
                            {lists.length > 1 && (
                              <button
                                className={classNames(styles.actionBtn, styles.deleteBtn)}
                                onClick={(e) => handleDeleteClick(e, list.id)}
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <span className={styles.count}>{symbolCount}</span>
        </div>
        <div className={styles.marketStatus}>
          <span
            className={classNames(
              styles.statusDot,
              isMarketOpen ? styles.open : styles.closed
            )}
          />
          <span className={styles.statusText}>{marketStatus}</span>
        </div>
      </div>

      {/* Source Toggle */}
      <div className={styles.toggleRow}>
        <div className={styles.sourceToggle}>
          <button
            className={classNames(
              styles.toggleBtn,
              { [styles.active]: sourceMode === 'watchlist' }
            )}
            onClick={() => onSourceModeChange('watchlist')}
          >
            Watchlist
          </button>
          <button
            className={classNames(
              styles.toggleBtn,
              { [styles.active]: sourceMode === 'custom' }
            )}
            onClick={() => onSourceModeChange('custom')}
          >
            Custom
          </button>
        </div>
      </div>
    </div>
  );
});

PositionTrackerHeader.displayName = 'PositionTrackerHeader';

export default PositionTrackerHeader;
