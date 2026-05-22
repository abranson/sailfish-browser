/*
 * Copyright (c) 2014 - 2021 Jolla Ltd.
 * Copyright (c) 2019 - 2021 Open Mobile Platform LLC.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef DECLARATIVEWEBPAGE_H
#define DECLARATIVEWEBPAGE_H

#include <qqml.h>
#include <QColor>
#include <QFutureWatcher>
#include <QMargins>
#include <QPointer>
#include <QRgb>
#include <qmozopenglwebpage.h>
#include <qmozgrabresult.h>
#include <qmozsecurity.h>

#include "tab.h"

class DeclarativeWebContainer;
class Link;

class DeclarativeWebPage : public QMozOpenGLWebPage
{
    Q_OBJECT
    Q_PROPERTY(DeclarativeWebContainer* container READ container NOTIFY containerChanged FINAL)
    Q_PROPERTY(int tabId READ tabId NOTIFY tabIdChanged FINAL)
    Q_PROPERTY(bool fullscreen READ fullscreen NOTIFY fullscreenChanged FINAL)
    Q_PROPERTY(bool forcedChrome READ forcedChrome NOTIFY forcedChromeChanged FINAL)
    Q_PROPERTY(QVariant resurrectedContentRect READ resurrectedContentRect WRITE setResurrectedContentRect NOTIFY resurrectedContentRectChanged)
    Q_PROPERTY(int virtualKeyboardHeight READ virtualKeyboardHeight WRITE setVirtualKeyboardHeight NOTIFY virtualKeyboardHeightChanged FINAL)
    Q_PROPERTY(qreal toolbarHeight READ toolbarHeight WRITE setToolbarHeight NOTIFY toolbarHeightChanged FINAL)
    Q_PROPERTY(bool fixedToolbar READ fixedToolbar WRITE setFixedToolbar NOTIFY fixedToolbarChanged)
    Q_PROPERTY(int safeAreaTop READ safeAreaTop WRITE setSafeAreaTop NOTIFY safeAreaInsetsChanged FINAL)
    Q_PROPERTY(int safeAreaRight READ safeAreaRight WRITE setSafeAreaRight NOTIFY safeAreaInsetsChanged FINAL)
    Q_PROPERTY(int safeAreaBottom READ safeAreaBottom WRITE setSafeAreaBottom NOTIFY safeAreaInsetsChanged FINAL)
    Q_PROPERTY(int safeAreaLeft READ safeAreaLeft WRITE setSafeAreaLeft NOTIFY safeAreaInsetsChanged FINAL)
    Q_PROPERTY(QString viewportFit READ viewportFit NOTIFY viewportFitChanged FINAL)
    Q_PROPERTY(int safeAreaInsetUsage READ safeAreaInsetUsage NOTIFY safeAreaInsetUsageChanged FINAL)
    Q_PROPERTY(QColor themeColor READ themeColor NOTIFY themeColorChanged FINAL)
    Q_PROPERTY(bool hasThemeColor READ hasThemeColor NOTIFY themeColorChanged FINAL)

public:
    DeclarativeWebPage(QObject *parent = 0);
    ~DeclarativeWebPage();

    DeclarativeWebContainer* container() const;
    void setContainer(DeclarativeWebContainer *container);

    int tabId() const;
    void setInitialState(const Tab& tab, bool privateMode);

    QVariant resurrectedContentRect() const;
    void setResurrectedContentRect(QVariant resurrectedContentRect);

    int virtualKeyboardHeight() const;
    void setVirtualKeyboardHeight(int height);

    qreal toolbarHeight() const;
    void setToolbarHeight(qreal);

    bool fixedToolbar() const;
    void setFixedToolbar(bool enable);

    int safeAreaTop() const;
    void setSafeAreaTop(int top);
    int safeAreaRight() const;
    void setSafeAreaRight(int right);
    int safeAreaBottom() const;
    void setSafeAreaBottom(int bottom);
    int safeAreaLeft() const;
    void setSafeAreaLeft(int left);
    QString viewportFit() const;
    int safeAreaInsetUsage() const;
    QColor themeColor() const;
    bool hasThemeColor() const;

    bool fullscreen() const;
    bool forcedChrome() const;

    Q_INVOKABLE void loadTab(const QString &newUrl, bool force, bool fromExternal);
    Q_INVOKABLE void grabToFile(const QSize& size);
    Q_INVOKABLE void grabThumbnail(const QSize& size);
    Q_INVOKABLE void forceChrome(bool forcedChrome);

signals:
    void contentOrientationChanged(Qt::ScreenOrientation orientation);
    void containerChanged();
    void tabIdChanged();
    void fullscreenChanged();
    void forcedChromeChanged();
    void resurrectedContentRectChanged();
    void fileGrabWritten(const QString &fileName);
    void thumbnailResult(const QString &data);

    void virtualKeyboardHeightChanged();
    void toolbarHeightChanged();
    void fixedToolbarChanged();
    void safeAreaInsetsChanged();
    void viewportFitChanged();
    void safeAreaInsetUsageChanged();
    void themeColorChanged();
    void neterror();

    void updateUrl();

private slots:
    void setFullscreen(const bool fullscreen);
    void onRecvAsyncMessage(const QString& message, const QVariant& data);
    void onTabHistoryAvailable(const int& historyTabId, const QList<Link>& links, int currentLinkId);
    void onUrlChanged();
    void handleFileGrabImage();
    void handleFileGrabFile();
    void thumbnailReady();
    void updateViewMargins();

private:
    static QString saveToFile(const QImage &image, const QString &path);

    void restoreHistory();
    void updateChromeState();
    void applySafeAreaInsets(const QMargins &insets);
    void setViewportFit(const QString &viewportFit);
    void setSafeAreaInsetUsage(int usage);
    void setThemeColor(const QColor &color);
    void updateMetadataTitle(const QString &title);

    QPointer<DeclarativeWebContainer> m_container;
    // Tab data fetched upon web page initialization. It never changes afterwards.
    Tab m_initialTab;
    bool m_fullscreen;
    bool m_forcedChrome;
    bool m_tabHistoryReady;
    bool m_urlReady;
    QVariant m_resurrectedContentRect;
    QSharedPointer<QMozGrabResult> m_grabResult;
    QSharedPointer<QMozGrabResult> m_thumbnailResult;
    QFutureWatcher<QString> m_grabWriter;
    QList<Link> m_restoredTabHistory;
    int m_restoredCurrentLinkId;

    int m_virtualKeyboardHeight = 0;
    qreal m_toolbarHeight;
    bool m_fixedToolbar = false;
    QMargins m_safeAreaInsets;
    QString m_viewportFit;
    int m_safeAreaInsetUsage;
    QColor m_themeColor;

    QMozSecurity m_security;
};

QDebug operator<<(QDebug, const DeclarativeWebPage *);

QML_DECLARE_TYPE(DeclarativeWebPage)

#endif
