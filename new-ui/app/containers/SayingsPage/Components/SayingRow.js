import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';

import PropTypes from 'prop-types';
import { Grid, FormControl, MenuItem, Select, TextField } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';

import messages from '../messages';

import HighlightedSaying from './HighlightedSaying';

import addActionIcon from '../../../images/add-action-icon.svg';

const styles = {
    userSays: {
        paddingRight: '5px',
        lineHeight: '1.5'
    },
    addActionIcon: {
        '&:hover': {
            filter: 'invert(1)',
        },
        cursor: 'pointer',
        verticalAlign: 'middle'
    },
    actionBackgroundContainer: {
        '&:hover': {
            backgroundColor: '#4e4e4e',
            color: '#fff',
        },
        cursor: 'pointer',
        margin: '0px 5px 0px 5px',
        fontSize: '12px',
        padding: '4px 8px 4px 10px',
        backgroundColor: '#e2e5e7',
        display: 'inline-block',
        position: 'relative',
        borderRadius: '5px',
        marginTop: '2px',
    },
    actionLabel: {
        textDecoration: 'none',
        color: 'inherit'
    },
    deleteActionX: {
        '&:hover': {
            fontWeight: 'bold'
        },
        paddingLeft: '5px',
        fontWeight: 300,
        cursor: 'pointer'
    },
    domainBackgroundContainer: {
        margin: '0px 5px 0px 0px',
        fontSize: '12px',
        padding: '4px 8px 4px 10px',
        backgroundColor: '#f6f7f8',
        display: 'inline-block',
        position: 'relative',
        borderRadius: '5px',
        marginTop: '2px',
    },
    domainLabel: {
        textDecoration: 'none',
        color: 'inherit'
    },
    categorySelectContainer: {
        margin: '0px',
    },
    categorySelectInputContainer: {
        margin: '0px !important',
    },
    categorySelect: {
        padding: '5px',
        backgroundColor: '#f6f7f8',
        border: 'none',
    },
    categoryLabel: {
        fontSize: '12px',
    }
}

/* eslint-disable react/prefer-stateless-function */
class SayingRow extends React.Component {

    constructor(){
        super();
        this.onHighlight = this.onHighlight.bind(this);
        this.handleChange = this.handleChange.bind(this);
    }

    state = {
        openActions: false,
        openKeywords: false,
        anchorEl: null,
        highlightedValue: null,
        start: null,
        end: null,
    };

    handleClose = (selectName) => {
        if (selectName === 'actions'){
            this.setState({
                openActions: false,
                anchorEl: null
            });
        }
        if (selectName === 'keywords'){
            this.setState({
                openKeywords: false,
                anchorEl: null
            });
        }
    };

    handleOpen = (selectName, target) => {
        if (selectName === 'actions'){
            this.setState({
                anchorEl: target,
                openActions: true
            });
        }
        if (selectName === 'keywords'){
            this.setState({
                anchorEl: target,
                openKeywords: true
            });
        }
    };

    handleChange(selectName, selectedValue){
        if (selectName === 'actions'){
            if (selectedValue === 'create'){
                this.props.onSendSayingToAction(this.props.saying);
                this.props.onGoToUrl(`/agent/${this.props.agentId}/action/create`);
            }
            else {
                this.props.onAddAction(this.props.saying, selectedValue)
            }
        }
        if (selectName === 'keywords'){
            if (selectedValue === 'create'){
                this.props.onGoToUrl(`/agent/${this.props.agentId}/keyword/create`);
            }
            else {
                const keyword = selectedValue.split(',');
                const keywordId = keyword[0]; //TODO: change this to parseInt(keyword[0]) when the id of the keyword transforms into an integer
                const keywordName = keyword[1];
                this.props.onTagKeyword(this.props.saying, this.state.highlightedValue, this.state.start, this.state.end, keywordId, keywordName);
            }
        }
    }

    onHighlight(evt){
        const selection = window.getSelection();
        const text = selection.toString();
        const offset = this.props.saying.userSays.indexOf(selection.anchorNode.textContent); //calculates where the chunk starts in the saying
        const start = selection.getRangeAt(0).startOffset + offset; 
        const end = selection.getRangeAt(0).endOffset + offset;
        const highlightedValue = selection.anchorNode.parentElement.parentElement.innerText.substring(start, end);
        if(text.trim()){
            this.setState({
                highlightedValue,
                start,
                end,
            });
            this.handleOpen('keywords', evt.target);
        }
    }

    render(){
        const { classes, saying, agentKeywords } = this.props;
        return (
            <Grid container>
                <Grid item xs={12}>
                    <Grid container spacing={16}>
                        <div style={{ width: '100px', marginTop: '5px'}}>
                            <TextField
                                className={classes.categorySelectContainer}
                                select
                                id='category'
                                value={saying.domain}
                                onChange={() => { console.error('Updating the domain of a saying is still not implemented. Sorry') }}
                                margin='normal'
                                fullWidth
                                InputProps={{
                                    className: classes.categorySelectInputContainer,
                                }}
                                inputProps={{
                                    className: classes.categorySelect,
                                }}
                            >
                                {this.props.agentDomains.map((domain, index) => {
                                    //TODO: return the domain id in the API to be able to select the domain id of the saying in
                                    return (
                                        <MenuItem key={`domain_${index}`} style={{minWidth: '150px'}} value={domain.id}>
                                            <span className={classes.categoryLabel}>{domain.domainName}</span>
                                        </MenuItem>
                                    )
                                })}
                            </TextField>
                        </div>
                        <Grid item md={10} xs={8}>
                            <span className={classes.userSays} onMouseUp={(evt) => { this.onHighlight(evt) }}>
                                <HighlightedSaying
                                    agentKeywords={agentKeywords}
                                    keywords={saying.keywords}
                                    text={saying.userSays}
                                    keywordIndex={0}
                                    lastStart={0}
                                    onUntagKeyword={this.props.onUntagKeyword.bind(null, saying)}
                                />
                            </span>
                            {saying.actions.map((action, index) => {
                                let actionId = this.props.agentActions.filter((agentAction) => {
                                    return agentAction.actionName === action;
                                });
                                actionId = actionId ? (Array.isArray(actionId) && actionId.length > 0 ? actionId[0].id : 2) : null;
                                return (
                                    <div key={`sayingAction_${index}`} className={classes.actionBackgroundContainer}>
                                        <span
                                            className={classes.actionLabel}
                                            onClick={() => {
                                                this.props.onSendSayingToAction(saying);
                                                this.props.onGoToUrl(`/agent/${this.props.agentId}/action/${actionId}`)
                                            }
                                        }
                                        >{action}</span>
                                        <a onClick={() => { this.props.onDeleteAction(saying, action) }} className={classes.deleteActionX}>x</a>
                                    </div>
                                )
                            })}
                            <img
                                onClick={(evt) => this.handleOpen('actions', evt.target)}
                                className={classes.addActionIcon} src={addActionIcon}
                            />
                            <FormControl className={classes.formControl}>
                                <Select
                                    style={{
                                        display:'none',
                                    }}
                                    open={this.state.openActions}
                                    onClose={() => this.handleClose('actions')}
                                    onOpen={(evt) => this.handleOpen('actions', evt.target)}
                                    value={10}
                                    onChange={(evt) => { evt.preventDefault(); this.handleChange('actions', evt.target.value)}}
                                    MenuProps={{
                                        style:{
                                            minHeight: '300px',
                                            maxHeight: '300px',
                                        },
                                        anchorEl: this.state.anchorEl
                                    }}
                                >
                                    <MenuItem value='create'><FormattedMessage className={classes.newItem} {...messages.newAction}/></MenuItem>
                                    {
                                        this.props.agentActions.map((action) => {
                                            return (
                                                saying.actions.indexOf(action.actionName) === -1 ?
                                                <MenuItem style={{width: '200px'}} key={`action_${action.id}`} value={action.actionName}>{action.actionName}</MenuItem> :
                                                null
                                            )
                                        })
                                    }
                                </Select>
                                <Select
                                    style={{
                                        display:'none',
                                    }}
                                    open={this.state.openKeywords}
                                    onClose={() => this.handleClose('keywords')}
                                    onOpen={(evt) => this.handleOpen('keywords', evt.target)}
                                    value={10}
                                    onChange={(evt) => { evt.preventDefault(); this.handleChange('keywords', evt.target.value)}}
                                    MenuProps={{
                                        anchorEl: this.state.anchorEl
                                    }}
                                >
                                    <MenuItem value='create'><FormattedMessage className={classes.newItem} {...messages.newKeyword}/></MenuItem>
                                    {agentKeywords.map((keyword, index) => {
                                        return (
                                            <MenuItem key={`keyword_${index}`} value={`${keyword.id},${keyword.keywordName}`}>
                                                <span style={{color: keyword.uiColor}} >{keyword.keywordName}</span>
                                            </MenuItem>
                                        );
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
        );
    }
}

SayingRow.propTypes = {
    classes: PropTypes.object,
    saying: PropTypes.object,
    agentId: PropTypes.string,
    agentKeywords: PropTypes.array,
    agentActions: PropTypes.array,
    agentDomains: PropTypes.array,
    onDeleteAction: PropTypes.func,
    onUntagKeyword: PropTypes.func,
    onTagKeyword: PropTypes.func,
    onAddAction: PropTypes.func,
    onGoToUrl: PropTypes.func,
    onSendSayingToAction: PropTypes.func,
};

export default withStyles(styles)(SayingRow);